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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fetchChambres, fetchHebergementReferences } from "@/lib/hebergement";
import { fetchMaisons, type MaisonListItem } from "@/lib/maisons";
import {
  createPromotion,
  deletePromotion,
  fetchPromotions,
  updatePromotion,
  type Promotion,
  type PromotionApplicableA,
  type PromotionFormData,
  type PromotionStatut,
  type PromotionTypeCondition,
  type PromotionTypeReduction,
} from "@/lib/promotions";

const CONDITION_LABELS: Record<PromotionTypeCondition, string> = {
  early_booking: "Early booking",
  last_minute: "Last minute",
  duree_minimum: "Durée minimum",
  code_promo: "Code promo",
  saisonniere: "Saisonnière",
  sans_condition: "Sans condition",
};

const STATUT_LABELS: Record<PromotionStatut, string> = {
  active: "Active",
  inactive: "Inactive",
  expiree: "Expirée",
};

const APPLICABLE_LABELS: Record<PromotionApplicableA, string> = {
  toutes_chambres: "Toutes les chambres",
  categorie: "Par catégorie",
  chambre_specifique: "Chambre spécifique",
};

type FormState = {
  maison_id: string;
  nom: string;
  code_promo: string;
  description: string;
  type_reduction: PromotionTypeReduction;
  valeur_reduction: string;
  type_condition: PromotionTypeCondition;
  jours_avant_min: string;
  jours_avant_max: string;
  duree_sejour_min: string;
  applicable_a: PromotionApplicableA;
  categorie_id: string;
  chambre_id: string;
  inclut_supplements: boolean;
  date_debut_validite: string;
  date_fin_validite: string;
  date_debut_sejour: string;
  date_fin_sejour: string;
  utilisation_max: string;
  cumulable: boolean;
  statut: PromotionStatut;
};

function emptyForm(maisonId = ""): FormState {
  return {
    maison_id: maisonId,
    nom: "",
    code_promo: "",
    description: "",
    type_reduction: "pourcentage",
    valeur_reduction: "",
    type_condition: "sans_condition",
    jours_avant_min: "",
    jours_avant_max: "",
    duree_sejour_min: "",
    applicable_a: "toutes_chambres",
    categorie_id: "",
    chambre_id: "",
    inclut_supplements: false,
    date_debut_validite: "",
    date_fin_validite: "",
    date_debut_sejour: "",
    date_fin_sejour: "",
    utilisation_max: "",
    cumulable: false,
    statut: "active",
  };
}

function dateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function toFormState(promotion: Promotion): FormState {
  return {
    maison_id: promotion.maison_id ? String(promotion.maison_id) : "",
    nom: promotion.nom,
    code_promo: promotion.code_promo || "",
    description: promotion.description || "",
    type_reduction: promotion.type_reduction,
    valeur_reduction: String(promotion.valeur_reduction),
    type_condition: promotion.type_condition,
    jours_avant_min:
      promotion.jours_avant_min != null ? String(promotion.jours_avant_min) : "",
    jours_avant_max:
      promotion.jours_avant_max != null ? String(promotion.jours_avant_max) : "",
    duree_sejour_min:
      promotion.duree_sejour_min != null ? String(promotion.duree_sejour_min) : "",
    applicable_a: promotion.applicable_a,
    categorie_id: promotion.categorie_id ? String(promotion.categorie_id) : "",
    chambre_id: promotion.chambre_id ? String(promotion.chambre_id) : "",
    inclut_supplements: Boolean(promotion.inclut_supplements),
    date_debut_validite: dateInput(promotion.date_debut_validite),
    date_fin_validite: dateInput(promotion.date_fin_validite),
    date_debut_sejour: dateInput(promotion.date_debut_sejour),
    date_fin_sejour: dateInput(promotion.date_fin_sejour),
    utilisation_max:
      promotion.utilisation_max != null ? String(promotion.utilisation_max) : "",
    cumulable: Boolean(promotion.cumulable),
    statut: promotion.statut,
  };
}

function formatReduction(promotion: Promotion) {
  const value = Number(promotion.valeur_reduction);

  if (promotion.type_reduction === "pourcentage") {
    return `${value}%`;
  }

  return `${value} MAD`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

function statutBadgeClass(statut: PromotionStatut) {
  if (statut === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (statut === "expiree") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export function PromotionsManagement() {
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [maisonFilter, setMaisonFilter] = useState("all");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<{ id: number; nom: string }[]>([]);
  const [chambres, setChambres] = useState<{ id: number; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMaisons = useCallback(async () => {
    const data = await fetchMaisons();
    setMaisons(data);
    setMaisonFilter((current) => current || (data[0] ? String(data[0].id) : "all"));
  }, []);

  const loadPromotions = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const maisonId = maisonFilter !== "all" ? Number(maisonFilter) : undefined;
      const data = await fetchPromotions(maisonId);
      setPromotions(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de charger les promotions."
      );
    } finally {
      setLoading(false);
    }
  }, [maisonFilter]);

  useEffect(() => {
    void loadMaisons().catch((error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de charger les maisons."
      );
    });
  }, [loadMaisons]);

  useEffect(() => {
    void loadPromotions();
  }, [loadPromotions]);

  useEffect(() => {
    let cancelled = false;

    const loadReferences = async () => {
      if (!form.maison_id) {
        setCategories([]);
        setChambres([]);
        return;
      }

      try {
        const [references, chambresData] = await Promise.all([
          fetchHebergementReferences(),
          fetchChambres(Number(form.maison_id)),
        ]);

        if (cancelled) return;

        setCategories(references.categories_chambre);
        setChambres(chambresData.map((c) => ({ id: c.id, nom: c.nom })));
      } catch {
        if (!cancelled) {
          setCategories([]);
          setChambres([]);
        }
      }
    };

    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, [form.maison_id]);

  const filteredPromotions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return promotions;

    return promotions.filter((promotion) => {
      return (
        promotion.nom.toLowerCase().includes(query) ||
        (promotion.code_promo || "").toLowerCase().includes(query) ||
        (promotion.maison_nom || "").toLowerCase().includes(query)
      );
    });
  }, [promotions, search]);

  const openCreate = () => {
    setEditingPromotion(null);
    setForm(emptyForm(maisonFilter !== "all" ? maisonFilter : ""));
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setForm(toFormState(promotion));
    setFormError("");
    setDialogOpen(true);
  };

  const buildPayload = (): PromotionFormData => ({
    maison_id: form.maison_id ? Number(form.maison_id) : null,
    nom: form.nom.trim(),
    code_promo: form.code_promo.trim() || undefined,
    description: form.description.trim() || undefined,
    type_reduction: form.type_reduction,
    valeur_reduction: Number(form.valeur_reduction),
    type_condition: form.type_condition,
    jours_avant_min: form.jours_avant_min ? Number(form.jours_avant_min) : null,
    jours_avant_max: form.jours_avant_max ? Number(form.jours_avant_max) : null,
    duree_sejour_min: form.duree_sejour_min ? Number(form.duree_sejour_min) : null,
    applicable_a: form.applicable_a,
    categorie_id:
      form.applicable_a === "categorie" && form.categorie_id
        ? Number(form.categorie_id)
        : null,
    chambre_id:
      form.applicable_a === "chambre_specifique" && form.chambre_id
        ? Number(form.chambre_id)
        : null,
    inclut_supplements: form.inclut_supplements,
    date_debut_validite: form.date_debut_validite,
    date_fin_validite: form.date_fin_validite,
    date_debut_sejour: form.date_debut_sejour || undefined,
    date_fin_sejour: form.date_fin_sejour || undefined,
    utilisation_max: form.utilisation_max ? Number(form.utilisation_max) : null,
    cumulable: form.cumulable,
    statut: form.statut,
  });

  const savePromotion = async () => {
    if (!form.nom.trim()) {
      setFormError("Le nom est requis.");
      return;
    }

    if (!form.date_debut_validite || !form.date_fin_validite) {
      setFormError("Les dates de validité sont requises.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = buildPayload();

      if (editingPromotion) {
        await updatePromotion(editingPromotion.id, payload);
      } else {
        await createPromotion(payload);
      }

      setDialogOpen(false);
      await loadPromotions();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Impossible d'enregistrer la promotion."
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await deletePromotion(deleteTarget.id);
      setDeleteTarget(null);
      await loadPromotions();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de supprimer la promotion."
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const showEarlyBookingFields =
    form.type_condition === "early_booking" || form.type_condition === "last_minute";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[22px]">
            Promotions
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Gérez les réductions, codes promo et conditions commerciales par maison.
          </p>
        </div>

        <Button onClick={openCreate} className="rounded-full">
          <Plus className="h-4 w-4" />
          Nouvelle promotion
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, code ou maison…"
            className="h-11 rounded-xl pl-10"
          />
        </div>

        <Select value={maisonFilter} onValueChange={setMaisonFilter}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Filtrer par maison" />
          </SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="all">Toutes les maisons</SelectItem>
            {maisons.map((maison) => (
              <SelectItem key={maison.id} value={String(maison.id)}>
                {maison.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <TableHead>Code</TableHead>
              <TableHead>Réduction</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Validité</TableHead>
              <TableHead>Maison</TableHead>
              <TableHead>Utilisation</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                  Chargement des promotions…
                </TableCell>
              </TableRow>
            ) : filteredPromotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                  Aucune promotion trouvée.
                </TableCell>
              </TableRow>
            ) : (
              filteredPromotions.map((promotion) => (
                <TableRow key={promotion.id}>
                  <TableCell className="font-medium">{promotion.nom}</TableCell>
                  <TableCell>{promotion.code_promo || "—"}</TableCell>
                  <TableCell>{formatReduction(promotion)}</TableCell>
                  <TableCell>{CONDITION_LABELS[promotion.type_condition]}</TableCell>
                  <TableCell>
                    {formatDate(promotion.date_debut_validite)} →{" "}
                    {formatDate(promotion.date_fin_validite)}
                  </TableCell>
                  <TableCell>{promotion.maison_nom || "Toutes"}</TableCell>
                  <TableCell>
                    {promotion.utilisation_actuelle}
                    {promotion.utilisation_max != null ? ` / ${promotion.utilisation_max}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statutBadgeClass(promotion.statut)}>
                      {STATUT_LABELS[promotion.statut]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(promotion)}>
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(promotion)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingPromotion ? "Modifier la promotion" : "Nouvelle promotion"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Informations générales</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nom</Label>
                  <Input
                    value={form.nom}
                    onChange={(e) => setForm((c) => ({ ...c, nom: e.target.value }))}
                    placeholder="Ex. Offre été -15%"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maison d'hôtes</Label>
                  <Select
                    value={form.maison_id || "none"}
                    onValueChange={(value) =>
                      setForm((c) => ({
                        ...c,
                        maison_id: value === "none" ? "" : value,
                        categorie_id: "",
                        chambre_id: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes les maisons" />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      <SelectItem value="none">Toutes les maisons</SelectItem>
                      {maisons.map((maison) => (
                        <SelectItem key={maison.id} value={String(maison.id)}>
                          {maison.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={form.statut}
                    onValueChange={(value) =>
                      setForm((c) => ({ ...c, statut: value as PromotionStatut }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      {Object.entries(STATUT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Réduction</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type de réduction</Label>
                  <Select
                    value={form.type_reduction}
                    onValueChange={(value) =>
                      setForm((c) => ({
                        ...c,
                        type_reduction: value as PromotionTypeReduction,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      <SelectItem value="pourcentage">Pourcentage (%)</SelectItem>
                      <SelectItem value="valeur">Montant fixe (MAD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valeur</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valeur_reduction}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, valeur_reduction: e.target.value }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Conditions</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Type de condition</Label>
                  <Select
                    value={form.type_condition}
                    onValueChange={(value) =>
                      setForm((c) => ({
                        ...c,
                        type_condition: value as PromotionTypeCondition,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.type_condition === "code_promo" ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Code promo</Label>
                    <Input
                      value={form.code_promo}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, code_promo: e.target.value.toUpperCase() }))
                      }
                      placeholder="ETE2026"
                    />
                  </div>
                ) : null}

                {showEarlyBookingFields ? (
                  <>
                    <div className="space-y-2">
                      <Label>Jours avant (min)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.jours_avant_min}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, jours_avant_min: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jours avant (max)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.jours_avant_max}
                        onChange={(e) =>
                          setForm((c) => ({ ...c, jours_avant_max: e.target.value }))
                        }
                      />
                    </div>
                  </>
                ) : null}

                {form.type_condition === "duree_minimum" ? (
                  <div className="space-y-2">
                    <Label>Durée minimum de séjour (nuits)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.duree_sejour_min}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, duree_sejour_min: e.target.value }))
                      }
                    />
                  </div>
                ) : null}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Applicabilité</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Portée</Label>
                  <Select
                    value={form.applicable_a}
                    onValueChange={(value) =>
                      setForm((c) => ({
                        ...c,
                        applicable_a: value as PromotionApplicableA,
                        categorie_id: "",
                        chambre_id: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      {Object.entries(APPLICABLE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.applicable_a === "categorie" ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Catégorie de chambre</Label>
                    <Select
                      value={form.categorie_id || undefined}
                      onValueChange={(value) =>
                        setForm((c) => ({ ...c, categorie_id: value }))
                      }
                      disabled={!form.maison_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                      <SelectContent className="z-[300]">
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {form.applicable_a === "chambre_specifique" ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Chambre</Label>
                    <Select
                      value={form.chambre_id || undefined}
                      onValueChange={(value) => setForm((c) => ({ ...c, chambre_id: value }))}
                      disabled={!form.maison_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une chambre" />
                      </SelectTrigger>
                      <SelectContent className="z-[300]">
                        {chambres.map((chambre) => (
                          <SelectItem key={chambre.id} value={String(chambre.id)}>
                            {chambre.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Inclure les suppléments</p>
                    <p className="text-xs text-slate-500">
                      La réduction s'applique aussi aux suppléments.
                    </p>
                  </div>
                  <Switch
                    checked={form.inclut_supplements}
                    onCheckedChange={(checked) =>
                      setForm((c) => ({ ...c, inclut_supplements: checked }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Validité & limites</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Début validité</Label>
                  <Input
                    type="date"
                    value={form.date_debut_validite}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, date_debut_validite: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fin validité</Label>
                  <Input
                    type="date"
                    value={form.date_fin_validite}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, date_fin_validite: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Début séjour (optionnel)</Label>
                  <Input
                    type="date"
                    value={form.date_debut_sejour}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, date_debut_sejour: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fin séjour (optionnel)</Label>
                  <Input
                    type="date"
                    value={form.date_fin_sejour}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, date_fin_sejour: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Utilisation max (optionnel)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.utilisation_max}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, utilisation_max: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Cumulable</p>
                    <p className="text-xs text-slate-500">Peut se combiner avec d'autres offres.</p>
                  </div>
                  <Switch
                    checked={form.cumulable}
                    onCheckedChange={(checked) => setForm((c) => ({ ...c, cumulable: checked }))}
                  />
                </div>
              </div>
            </section>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void savePromotion()} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette promotion ?</AlertDialogTitle>
            <AlertDialogDescription>
              La promotion « {deleteTarget?.nom} » sera définitivement supprimée.
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
