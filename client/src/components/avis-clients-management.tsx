import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, MoreVertical, Search, Star, Trash2 } from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getAuthToken } from "@/lib/auth";
import {
  deleteAvisClient,
  fetchAvisClients,
  updateAvisClient,
  type AvisClient,
  type AvisStatut,
} from "@/lib/avis-clients";
import { fetchMaisons, type MaisonListItem } from "@/lib/maisons";

const STATUT_LABELS: Record<AvisStatut, string> = {
  en_attente: "En attente",
  publie: "Affiché B2C",
  masque: "Masqué B2C",
  signale: "Signalé",
};

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  return String(value).slice(0, 10);
}

function Stars({ note }: { note: number }) {
  return (
    <div className="flex items-center gap-0.5" style={{ color: "var(--terracotta)" }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${index < note ? "fill-current" : ""}`}
        />
      ))}
    </div>
  );
}

export function AvisClientsManagement() {
  const [items, setItems] = useState<AvisClient[]>([]);
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<AvisStatut | "all">("all");
  const [maisonFilter, setMaisonFilter] = useState<string>("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!getAuthToken()) {
      setError("Session expirée.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [avis, maisonsData] = await Promise.all([
        fetchAvisClients(),
        fetchMaisons(),
      ]);
      setItems(avis);
      setMaisons(maisonsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les avis.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      if (statutFilter !== "all" && item.statut !== statutFilter) {
        return false;
      }

      if (maisonFilter !== "all" && String(item.maison_id) !== maisonFilter) {
        return false;
      }

      if (!q) {
        return true;
      }

      return [
        item.nom,
        item.email,
        item.titre,
        item.commentaire,
        item.maison_nom,
        item.maison_ville,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, statutFilter, maisonFilter]);

  const applyLocalUpdate = (avis: AvisClient) => {
    setItems((current) =>
      current.map((item) => (item.id === avis.id ? avis : item))
    );
  };

  const setB2cVisibility = async (avis: AvisClient, visible: boolean) => {
    setTogglingId(avis.id);
    setError("");

    try {
      const result = await updateAvisClient(avis.id, {
        statut: visible ? "publie" : "masque",
      });
      applyLocalUpdate(result.avis);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de mettre à jour la visibilité B2C."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await deleteAvisClient(deleteId);
      setItems((current) => current.filter((item) => item.id !== deleteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer.");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Gestion avis clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Modérez les avis et contrôlez l’affichage sur le site (B2C).
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Actualiser
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, email, maison, commentaire…"
            className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <Select
          value={statutFilter}
          onValueChange={(value) => setStatutFilter(value as AvisStatut | "all")}
        >
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(Object.keys(STATUT_LABELS) as AvisStatut[]).map((statut) => (
              <SelectItem key={statut} value={statut}>
                {STATUT_LABELS[statut]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={maisonFilter} onValueChange={setMaisonFilter}>
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue placeholder="Maison" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les maisons</SelectItem>
            {maisons.map((maison) => (
              <SelectItem key={maison.id} value={String(maison.id)}>
                {maison.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Maison</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Avis</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>B2C</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Aucun avis trouvé.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((avis) => {
                const onB2c = avis.statut === "publie";
                const busy = togglingId === avis.id;

                return (
                  <TableRow key={avis.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(avis.date_creation)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{avis.nom}</div>
                      <div className="text-xs text-muted-foreground">{avis.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {avis.maison_nom || `Maison #${avis.maison_id}`}
                      </div>
                      {avis.maison_ville ? (
                        <div className="text-xs text-muted-foreground">
                          {avis.maison_ville}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Stars note={avis.note} />
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      {avis.titre ? (
                        <div className="truncate text-sm font-medium">{avis.titre}</div>
                      ) : null}
                      <div className="truncate text-sm text-muted-foreground">
                        {avis.commentaire}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{STATUT_LABELS[avis.statut]}</Badge>
                    </TableCell>
                    <TableCell>
                      {onB2c ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void setB2cVisibility(avis, false)}
                          className="gap-1.5"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          Masquer du B2C
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void setB2cVisibility(avis, true)}
                          className="gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Afficher dans B2C
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onB2c ? (
                            <DropdownMenuItem
                              disabled={busy}
                              onClick={() => void setB2cVisibility(avis, false)}
                            >
                              Masquer du B2C
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={busy}
                              onClick={() => void setB2cVisibility(avis, true)}
                            >
                              Afficher dans B2C
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(avis.id)}
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

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet avis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. L’avis sera retiré de la base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
