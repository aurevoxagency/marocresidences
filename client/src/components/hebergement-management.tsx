import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarRange, MoreVertical, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildEmptyChambreTarifs,
  buildEmptySupplementTarifs,
  createChambre,
  createSaison,
  deleteChambre,
  deleteSaison,
  fetchChambre,
  fetchChambres,
  fetchHebergementReferences,
  fetchSaisons,
  fetchSupplementTarifs,
  mergeChambreTarifs,
  mergeSupplementTarifs,
  updateChambre,
  updateSaison,
  updateSupplementTarifs,
  type ChambreDetail,
  type ChambreListItem,
  type HebergementReferences,
  type Saison,
  type SupplementTarifRow,
  type TarifChambre,
  type TarifSupplement,
} from "@/lib/hebergement";
import { fetchMaisons, type MaisonListItem } from "@/lib/maisons";

type SaisonFormState = {
  nom: string;
  date_debut: string;
  date_fin: string;
  couleur: string;
};

type ChambreFormState = {
  nom: string;
  categorie_id: string;
  type_id: string;
  allotement: string;
  capacite_max: string;
  marge_type: "pourcentage" | "valeur";
  marge_valeur: string;
  statut: "actif" | "inactif";
  tarifs: TarifChambre[];
};

function emptySaisonForm(): SaisonFormState {
  return { nom: "", date_debut: "", date_fin: "", couleur: "#3b82f6" };
}

function emptyChambreForm(
  references: HebergementReferences | null,
  saisons: Saison[]
): ChambreFormState {
  return {
    nom: "",
    categorie_id: references?.categories_chambre[0]?.id?.toString() || "",
    type_id: references?.types_chambre[0]?.id?.toString() || "",
    allotement: "1",
    capacite_max: "2",
    marge_type: "pourcentage",
    marge_valeur: "0",
    statut: "actif",
    tarifs:
      references && saisons.length > 0
        ? buildEmptyChambreTarifs(saisons, references.tranches_age)
        : [],
  };
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

function TarifsEditor<T extends TarifChambre>({
  saisons,
  tranches,
  tarifs,
  onChange,
  showPrixBebe = false,
}: {
  saisons: Saison[];
  tranches: HebergementReferences["tranches_age"];
  tarifs: T[];
  onChange: (tarifs: T[]) => void;
  showPrixBebe?: boolean;
}) {
  if (saisons.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Créez d'abord au moins une saison pour définir les tarifs.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {saisons.map((saison) => {
        const tarif = tarifs.find((row) => row.saison_id === saison.id);
        const tarifIndex = tarifs.findIndex((row) => row.saison_id === saison.id);

        if (!tarif || tarifIndex < 0) {
          return null;
        }

        return (
          <div key={saison.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: saison.couleur || "#3b82f6" }}
              />
              <p className="text-sm font-semibold text-slate-900">{saison.nom}</p>
              <span className="text-xs text-slate-400">
                {formatDate(saison.date_debut)} → {formatDate(saison.date_fin)}
              </span>
            </div>

            <div className={`grid gap-3 ${showPrixBebe ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
              <div className="space-y-2">
                <Label>Prix adulte (MAD)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tarif.prix_adulte}
                  onChange={(e) => {
                    const next = [...tarifs];
                    next[tarifIndex] = {
                      ...tarif,
                      prix_adulte: Number(e.target.value) || 0,
                    };
                    onChange(next);
                  }}
                />
              </div>
              {showPrixBebe ? (
                <div className="space-y-2">
                  <Label>Prix bébé (MAD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={"prix_bebe" in tarif ? Number(tarif.prix_bebe) : 0}
                    onChange={(e) => {
                      const next = [...tarifs];
                      next[tarifIndex] = {
                        ...tarif,
                        prix_bebe: Number(e.target.value) || 0,
                      } as T;
                      onChange(next);
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {tranches.map((tranche) => {
                const childIndex = tarif.tarifs_enfant.findIndex(
                  (row) => row.tranche_age_id === tranche.id
                );
                const child = tarif.tarifs_enfant[childIndex];

                if (!child) return null;

                return (
                  <div key={tranche.id} className="space-y-2">
                    <Label>{tranche.nom} (MAD)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={child.prix}
                      onChange={(e) => {
                        const next = [...tarifs];
                        const nextChildren = [...tarif.tarifs_enfant];
                        nextChildren[childIndex] = {
                          ...child,
                          prix: Number(e.target.value) || 0,
                        };
                        next[tarifIndex] = { ...tarif, tarifs_enfant: nextChildren };
                        onChange(next);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type HebergementTab = "saisons" | "chambres" | "supplements";

const TAB_COPY: Record<
  HebergementTab,
  { title: string; description: string }
> = {
  saisons: {
    title: "Gestion des saisons",
    description: "Définissez les périodes tarifaires de chaque maison d'hôtes.",
  },
  chambres: {
    title: "Gestion des chambres",
    description: "Configurez les chambres, capacités et tarifs par saison.",
  },
  supplements: {
    title: "Gestion des suppléments",
    description: "Gérez les tarifs des suppléments (repas, transferts, etc.) par saison.",
  },
};

export function HebergementManagement({
  defaultTab = "saisons",
  singleTab = true,
}: {
  defaultTab?: HebergementTab;
  singleTab?: boolean;
}) {
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [maisonId, setMaisonId] = useState("");
  const [references, setReferences] = useState<HebergementReferences | null>(null);
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [chambres, setChambres] = useState<ChambreListItem[]>([]);
  const [supplements, setSupplements] = useState<SupplementTarifRow[]>([]);
  const [loadingMaisons, setLoadingMaisons] = useState(true);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [referencesError, setReferencesError] = useState("");

  const [saisonDialogOpen, setSaisonDialogOpen] = useState(false);
  const [editingSaison, setEditingSaison] = useState<Saison | null>(null);
  const [saisonForm, setSaisonForm] = useState<SaisonFormState>(emptySaisonForm());
  const [deleteSaisonTarget, setDeleteSaisonTarget] = useState<Saison | null>(null);

  const [chambreDialogOpen, setChambreDialogOpen] = useState(false);
  const [editingChambre, setEditingChambre] = useState<ChambreDetail | null>(null);
  const [chambreForm, setChambreForm] = useState<ChambreFormState>(
    emptyChambreForm(null, [])
  );
  const [deleteChambreTarget, setDeleteChambreTarget] = useState<ChambreListItem | null>(null);

  const [supplementDialogOpen, setSupplementDialogOpen] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<SupplementTarifRow | null>(null);
  const [supplementTarifs, setSupplementTarifs] = useState<TarifSupplement[]>([]);
  const [activeTab, setActiveTab] = useState<HebergementTab>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const tabCopy = TAB_COPY[activeTab];

  const selectedMaison = useMemo(
    () => maisons.find((maison) => maison.id === Number(maisonId)),
    [maisonId, maisons]
  );

  const loadData = useCallback(async () => {
    if (!maisonId) {
      setSaisons([]);
      setChambres([]);
      setSupplements([]);
      return;
    }

    const id = Number(maisonId);
    const [nextSaisons, nextChambres, supplementData] = await Promise.all([
      fetchSaisons(id),
      fetchChambres(id),
      fetchSupplementTarifs(id),
    ]);

    setSaisons(nextSaisons);
    setChambres(nextChambres);
    setSupplements(supplementData.supplements);
  }, [maisonId]);

  useEffect(() => {
    let cancelled = false;

    const loadMaisons = async () => {
      setLoadingMaisons(true);
      setErrorMessage("");

      try {
        const nextMaisons = await fetchMaisons();

        if (cancelled) {
          return;
        }

        setMaisons(nextMaisons);
        setMaisonId((current) => current || (nextMaisons[0] ? String(nextMaisons[0].id) : ""));
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Impossible de charger les maisons."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingMaisons(false);
        }
      }
    };

    const loadReferences = async () => {
      setLoadingReferences(true);
      setReferencesError("");

      try {
        const nextReferences = await fetchHebergementReferences();

        if (!cancelled) {
          setReferences(nextReferences);
        }
      } catch (error) {
        if (!cancelled) {
          setReferencesError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les catalogues chambres/suppléments."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingReferences(false);
        }
      }
    };

    void loadMaisons();
    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!maisonId || loadingMaisons) return;

    void loadData().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Chargement impossible.");
    });
  }, [loadData, loadingMaisons, maisonId]);

  const openCreateSaison = () => {
    setEditingSaison(null);
    setSaisonForm(emptySaisonForm());
    setSaisonDialogOpen(true);
  };

  const openEditSaison = (saison: Saison) => {
    setEditingSaison(saison);
    setSaisonForm({
      nom: saison.nom,
      date_debut: saison.date_debut.slice(0, 10),
      date_fin: saison.date_fin.slice(0, 10),
      couleur: saison.couleur || "#3b82f6",
    });
    setSaisonDialogOpen(true);
  };

  const saveSaison = async () => {
    if (!maisonId) return;

    if (editingSaison) {
      await updateSaison(editingSaison.id, saisonForm);
    } else {
      await createSaison({
        maison_id: Number(maisonId),
        ...saisonForm,
      });
    }

    setSaisonDialogOpen(false);
    await loadData();
  };

  const openCreateChambre = () => {
    if (!references) return;

    setEditingChambre(null);
    setChambreForm(emptyChambreForm(references, saisons));
    setChambreDialogOpen(true);
  };

  const openEditChambre = async (chambre: ChambreListItem) => {
    if (!references) return;

    const detail = await fetchChambre(chambre.id);
    setEditingChambre(detail);
    setChambreForm({
      nom: detail.nom,
      categorie_id: String(detail.categorie_id),
      type_id: String(detail.type_id),
      allotement: String(detail.allotement),
      capacite_max: String(detail.capacite_max),
      marge_type: detail.marge_type,
      marge_valeur: String(detail.marge_valeur),
      statut: detail.statut,
      tarifs: mergeChambreTarifs(saisons, references.tranches_age, detail.tarifs),
    });
    setChambreDialogOpen(true);
  };

  const saveChambre = async () => {
    if (!maisonId || !references) return;

    const payload = {
      nom: chambreForm.nom,
      categorie_id: Number(chambreForm.categorie_id),
      type_id: Number(chambreForm.type_id),
      allotement: Number(chambreForm.allotement),
      capacite_max: Number(chambreForm.capacite_max),
      marge_type: chambreForm.marge_type,
      marge_valeur: Number(chambreForm.marge_valeur),
      statut: chambreForm.statut,
      tarifs: chambreForm.tarifs,
    };

    if (editingChambre) {
      await updateChambre(editingChambre.id, payload);
    } else {
      await createChambre({
        maison_id: Number(maisonId),
        ...payload,
      });
    }

    setChambreDialogOpen(false);
    await loadData();
  };

  const openSupplementTarifs = (supplement: SupplementTarifRow) => {
    if (!references) return;

    setEditingSupplement(supplement);
    setSupplementTarifs(
      mergeSupplementTarifs(saisons, references.tranches_age, supplement.tarifs)
    );
    setSupplementDialogOpen(true);
  };

  const saveSupplementTarifs = async () => {
    if (!editingSupplement || !maisonId) return;

    await updateSupplementTarifs(
      editingSupplement.id,
      Number(maisonId),
      supplementTarifs
    );
    setSupplementDialogOpen(false);
    await loadData();
  };

  if (loadingMaisons) {
    return <p className="text-sm text-muted-foreground">Chargement des maisons…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[22px]">
            {tabCopy.title}
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">{tabCopy.description}</p>
        </div>

        <div className="w-full sm:w-72">
          <Label>Maison d'hôtes</Label>
          <Select
            value={maisonId || undefined}
            onValueChange={setMaisonId}
            disabled={maisons.length === 0}
          >
            <SelectTrigger className="mt-2 h-11 rounded-xl">
              <SelectValue
                placeholder={
                  maisons.length === 0
                    ? "Aucune maison disponible"
                    : "Sélectionner une maison"
                }
              />
            </SelectTrigger>
            <SelectContent className="z-[200]">
              {maisons.map((maison) => (
                <SelectItem key={maison.id} value={String(maison.id)}>
                  {maison.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {referencesError ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {referencesError}
        </p>
      ) : null}

      {loadingReferences ? (
        <p className="text-sm text-muted-foreground">Chargement des catalogues…</p>
      ) : null}

      {!maisonId ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {maisons.length === 0
            ? "Aucune maison d'hôtes trouvée. Créez-en une dans « Maisons d'hôtes »."
            : "Sélectionnez une maison pour commencer."}
        </p>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as HebergementTab)}
          className="space-y-4"
        >
          {!singleTab ? (
            <TabsList className="grid h-11 w-full grid-cols-3 rounded-full bg-muted p-1">
              <TabsTrigger value="saisons" className="rounded-full text-sm">
                <CalendarRange className="mr-2 h-4 w-4" />
                Saisons
              </TabsTrigger>
              <TabsTrigger value="chambres" className="rounded-full text-sm">
                <BedDouble className="mr-2 h-4 w-4" />
                Chambres
              </TabsTrigger>
              <TabsTrigger value="supplements" className="rounded-full text-sm">
                <UtensilsCrossed className="mr-2 h-4 w-4" />
                Suppléments
              </TabsTrigger>
            </TabsList>
          ) : null}

          <TabsContent value="saisons" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openCreateSaison} className="rounded-full">
                <Plus className="h-4 w-4" />
                Nouvelle saison
              </Button>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Couleur</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saisons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                        Aucune saison définie pour {selectedMaison?.nom}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    saisons.map((saison) => (
                      <TableRow key={saison.id}>
                        <TableCell className="font-medium">{saison.nom}</TableCell>
                        <TableCell>
                          {formatDate(saison.date_debut)} → {formatDate(saison.date_fin)}
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-block h-4 w-4 rounded-full"
                            style={{ backgroundColor: saison.couleur || "#3b82f6" }}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditSaison(saison)}>
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteSaisonTarget(saison)}
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
          </TabsContent>

          <TabsContent value="chambres" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openCreateChambre} className="rounded-full">
                <Plus className="h-4 w-4" />
                Nouvelle chambre
              </Button>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Allotement</TableHead>
                    <TableHead>Capacité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chambres.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                        Aucune chambre configurée.
                      </TableCell>
                    </TableRow>
                  ) : (
                    chambres.map((chambre) => (
                      <TableRow key={chambre.id}>
                        <TableCell className="font-medium">{chambre.nom}</TableCell>
                        <TableCell>{chambre.categorie_nom}</TableCell>
                        <TableCell>{chambre.type_nom}</TableCell>
                        <TableCell>{chambre.allotement}</TableCell>
                        <TableCell>{chambre.capacite_max}</TableCell>
                        <TableCell className="capitalize">{chambre.statut}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void openEditChambre(chambre)}>
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteChambreTarget(chambre)}
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
          </TabsContent>

          <TabsContent value="supplements" className="space-y-4">
            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplément</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32">Tarifs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-slate-500">
                        Aucun supplément actif dans le catalogue.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplements.map((supplement) => (
                      <TableRow key={supplement.id}>
                        <TableCell className="font-medium">{supplement.nom}</TableCell>
                        <TableCell className="text-slate-500">
                          {supplement.description || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => openSupplementTarifs(supplement)}
                          >
                            <Pencil className="h-4 w-4" />
                            Tarifs
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={saisonDialogOpen} onOpenChange={setSaisonDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSaison ? "Modifier la saison" : "Nouvelle saison"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={saisonForm.nom}
                onChange={(e) => setSaisonForm((current) => ({ ...current, nom: e.target.value }))}
                placeholder="Haute saison"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date début</Label>
                <Input
                  type="date"
                  value={saisonForm.date_debut}
                  onChange={(e) =>
                    setSaisonForm((current) => ({ ...current, date_debut: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input
                  type="date"
                  value={saisonForm.date_fin}
                  onChange={(e) =>
                    setSaisonForm((current) => ({ ...current, date_fin: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur calendrier</Label>
              <Input
                type="color"
                value={saisonForm.couleur}
                onChange={(e) =>
                  setSaisonForm((current) => ({ ...current, couleur: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaisonDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void saveSaison()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chambreDialogOpen} onOpenChange={setChambreDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingChambre ? "Modifier la chambre" : "Nouvelle chambre"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nom</Label>
                <Input
                  value={chambreForm.nom}
                  onChange={(e) =>
                    setChambreForm((current) => ({ ...current, nom: e.target.value }))
                  }
                  placeholder="Chambre Menara"
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select
                  value={chambreForm.categorie_id}
                  onValueChange={(value) =>
                    setChambreForm((current) => ({ ...current, categorie_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {references?.categories_chambre.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={chambreForm.type_id}
                  onValueChange={(value) =>
                    setChambreForm((current) => ({ ...current, type_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {references?.types_chambre.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Allotement</Label>
                <Input
                  type="number"
                  min="1"
                  value={chambreForm.allotement}
                  onChange={(e) =>
                    setChambreForm((current) => ({ ...current, allotement: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Capacité max</Label>
                <Input
                  type="number"
                  min="1"
                  value={chambreForm.capacite_max}
                  onChange={(e) =>
                    setChambreForm((current) => ({ ...current, capacite_max: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Type de marge</Label>
                <Select
                  value={chambreForm.marge_type}
                  onValueChange={(value: "pourcentage" | "valeur") =>
                    setChambreForm((current) => ({ ...current, marge_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pourcentage">Pourcentage</SelectItem>
                    <SelectItem value="valeur">Valeur fixe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marge</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={chambreForm.marge_valeur}
                  onChange={(e) =>
                    setChambreForm((current) => ({ ...current, marge_valeur: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={chambreForm.statut}
                  onValueChange={(value: "actif" | "inactif") =>
                    setChambreForm((current) => ({ ...current, statut: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="inactif">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Tarifs par saison</Label>
              {references ? (
                <TarifsEditor
                  saisons={saisons}
                  tranches={references.tranches_age}
                  tarifs={chambreForm.tarifs}
                  onChange={(tarifs) => setChambreForm((current) => ({ ...current, tarifs }))}
                />
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChambreDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void saveChambre()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supplementDialogOpen} onOpenChange={setSupplementDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tarifs — {editingSupplement?.nom}</DialogTitle>
          </DialogHeader>
          {references ? (
            <TarifsEditor
              saisons={saisons}
              tranches={references.tranches_age}
              tarifs={supplementTarifs}
              onChange={setSupplementTarifs}
              showPrixBebe
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplementDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void saveSupplementTarifs()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteSaisonTarget)} onOpenChange={() => setDeleteSaisonTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette saison ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les tarifs liés à « {deleteSaisonTarget?.nom} » seront également supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteSaisonTarget) return;
                void deleteSaison(deleteSaisonTarget.id).then(loadData);
                setDeleteSaisonTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteChambreTarget)} onOpenChange={() => setDeleteChambreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette chambre ?</AlertDialogTitle>
            <AlertDialogDescription>
              La chambre « {deleteChambreTarget?.nom} » et ses tarifs seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteChambreTarget) return;
                void deleteChambre(deleteChambreTarget.id).then(loadData);
                setDeleteChambreTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
