import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, ImagePlus, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  createMaison,
  deleteMaison,
  fetchMaison,
  fetchMaisonReferences,
  fetchMaisons,
  resolvePhotoUrl,
  updateMaison,
  uploadMaisonPhoto,
  type MaisonDetail,
  type MaisonFormData,
  type MaisonHoraire,
  type MaisonListItem,
  type MaisonPhoto,
  type MaisonReferences,
  type MaisonStatut,
} from "@/lib/maisons";

const JOURS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

const STATUT_LABELS: Record<MaisonStatut, string> = {
  actif: "Actif",
  inactif: "Inactif",
  en_attente: "En attente",
};

type FormState = {
  nom: string;
  description: string;
  categorie: string;
  nb_chambres: string;
  lits_bebe_disponibles: boolean;
  nb_lits_bebe: string;
  adresse: string;
  quartier: string;
  ville: string;
  code_postal: string;
  pays: string;
  latitude: string;
  longitude: string;
  telephone: string;
  whatsapp: string;
  email: string;
  site_web: string;
  devise: string;
  taux_tva: string;
  taxe_de_sejour: string;
  numero_patente: string;
  numero_ice: string;
  numero_classement: string;
  statut: MaisonStatut;
  heure_checkin: string;
  heure_checkout: string;
  service_ids: number[];
  equipement_ids: number[];
  langue_ids: number[];
  photos: MaisonPhoto[];
  horaires: MaisonHoraire[];
};

function defaultHoraires(): MaisonHoraire[] {
  return JOURS.map((jour) => ({
    jour_semaine: jour,
    heure_ouverture: "08:00",
    heure_fermeture: "20:00",
    ferme: false,
  }));
}

function emptyForm(): FormState {
  return {
    nom: "",
    description: "",
    categorie: "",
    nb_chambres: "0",
    lits_bebe_disponibles: false,
    nb_lits_bebe: "0",
    adresse: "",
    quartier: "",
    ville: "",
    code_postal: "",
    pays: "Maroc",
    latitude: "",
    longitude: "",
    telephone: "",
    whatsapp: "",
    email: "",
    site_web: "",
    devise: "MAD",
    taux_tva: "0",
    taxe_de_sejour: "0",
    numero_patente: "",
    numero_ice: "",
    numero_classement: "",
    statut: "en_attente",
    heure_checkin: "14:00",
    heure_checkout: "12:00",
    service_ids: [],
    equipement_ids: [],
    langue_ids: [],
    photos: [{ url: "", legende: "", est_principale: true, ordre: 0 }],
    horaires: defaultHoraires(),
  };
}

function timeForInput(value?: string | null) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 5);
}

function formatTimeDisplay(value?: string | null) {
  const time = timeForInput(value);
  return time || "—";
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] text-slate-800">{value || "—"}</p>
    </div>
  );
}

function ZoomableImage({
  src,
  alt,
  className,
  onPreview,
}: {
  src: string;
  alt: string;
  className?: string;
  onPreview: (url: string | null) => void;
}) {
  const resolvedSrc = resolvePhotoUrl(src);

  return (
    <button
      type="button"
      className="block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd]"
      onMouseEnter={() => onPreview(resolvedSrc)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(resolvedSrc)}
      onBlur={() => onPreview(null)}
      aria-label={`Aperçu de ${alt}`}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        className={`object-cover transition duration-200 hover:scale-105 ${className || ""}`}
      />
    </button>
  );
}

function toFormState(maison: Awaited<ReturnType<typeof fetchMaison>>): FormState {
  const horairesByDay = new Map(
    maison.horaires.map((horaire) => [horaire.jour_semaine, horaire])
  );

  return {
    nom: maison.nom || "",
    description: maison.description || "",
    categorie: maison.categorie || "",
    nb_chambres: String(maison.nb_chambres ?? 0),
    lits_bebe_disponibles: Boolean(maison.lits_bebe_disponibles),
    nb_lits_bebe: String(maison.nb_lits_bebe ?? 0),
    adresse: maison.adresse || "",
    quartier: maison.quartier || "",
    ville: maison.ville || "",
    code_postal: maison.code_postal || "",
    pays: maison.pays || "Maroc",
    latitude: maison.latitude != null ? String(maison.latitude) : "",
    longitude: maison.longitude != null ? String(maison.longitude) : "",
    telephone: maison.telephone || "",
    whatsapp: maison.whatsapp || "",
    email: maison.email || "",
    site_web: maison.site_web || "",
    devise: maison.devise || "MAD",
    taux_tva: String(maison.taux_tva ?? 0),
    taxe_de_sejour: String(maison.taxe_de_sejour ?? 0),
    numero_patente: maison.numero_patente || "",
    numero_ice: maison.numero_ice || "",
    numero_classement: maison.numero_classement || "",
    statut: maison.statut || "en_attente",
    heure_checkin: timeForInput(maison.heure_checkin) || "14:00",
    heure_checkout: timeForInput(maison.heure_checkout) || "12:00",
    service_ids: maison.service_ids || [],
    equipement_ids: maison.equipement_ids || [],
    langue_ids: maison.langue_ids || [],
    photos:
      maison.photos.length > 0
        ? maison.photos.map((photo, index) => ({
            url: photo.url,
            legende: photo.legende || "",
            est_principale: Boolean(photo.est_principale),
            ordre: photo.ordre ?? index,
          }))
        : [{ url: "", legende: "", est_principale: true, ordre: 0 }],
    horaires: JOURS.map((jour) => {
      const existing = horairesByDay.get(jour);

      return {
        jour_semaine: jour,
        heure_ouverture: timeForInput(existing?.heure_ouverture) || "08:00",
        heure_fermeture: timeForInput(existing?.heure_fermeture) || "20:00",
        ferme: Boolean(existing?.ferme),
      };
    }),
  };
}

function toPayload(form: FormState): MaisonFormData {
  return {
    nom: form.nom.trim(),
    description: form.description.trim() || undefined,
    categorie: form.categorie.trim() || undefined,
    nb_chambres: Number(form.nb_chambres) || 0,
    lits_bebe_disponibles: form.lits_bebe_disponibles,
    nb_lits_bebe: form.lits_bebe_disponibles
      ? Math.max(0, Number(form.nb_lits_bebe) || 0)
      : 0,
    adresse: form.adresse.trim() || undefined,
    quartier: form.quartier.trim() || undefined,
    ville: form.ville.trim() || undefined,
    code_postal: form.code_postal.trim() || undefined,
    pays: form.pays.trim() || "Maroc",
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
    telephone: form.telephone.trim() || undefined,
    whatsapp: form.whatsapp.trim() || undefined,
    email: form.email.trim() || undefined,
    site_web: form.site_web.trim() || undefined,
    devise: form.devise.trim() || "MAD",
    taux_tva: Number(form.taux_tva) || 0,
    taxe_de_sejour: Number(form.taxe_de_sejour) || 0,
    numero_patente: form.numero_patente.trim() || undefined,
    numero_ice: form.numero_ice.trim() || undefined,
    numero_classement: form.numero_classement.trim() || undefined,
    statut: form.statut,
    heure_checkin: form.heure_checkin,
    heure_checkout: form.heure_checkout,
    service_ids: form.service_ids,
    equipement_ids: form.equipement_ids,
    langue_ids: form.langue_ids,
    photos: form.photos
      .filter((photo) => {
        const url = photo.url.trim();
        return Boolean(url) && !url.startsWith("blob:");
      })
      .map((photo, index) => ({
        url: photo.url.trim(),
        legende: photo.legende?.trim() || undefined,
        est_principale: Boolean(photo.est_principale),
        ordre: index,
      })),
    horaires: form.horaires.map((horaire) => ({
      jour_semaine: horaire.jour_semaine,
      heure_ouverture: horaire.ferme ? null : horaire.heure_ouverture,
      heure_fermeture: horaire.ferme ? null : horaire.heure_fermeture,
      ferme: Boolean(horaire.ferme),
    })),
  };
}

function toggleId(ids: number[], id: number) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function statutBadgeClass(statut: MaisonStatut) {
  if (statut === "actif") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (statut === "inactif") {
    return "bg-slate-100 text-slate-600";
  }

  return "bg-amber-50 text-amber-700";
}

export function MaisonsManagement() {
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [references, setReferences] = useState<MaisonReferences>({
    services: [],
    equipements: [],
    langues: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaisonListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<number | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewMaison, setViewMaison] = useState<MaisonDetail | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [hoveredPhoto, setHoveredPhoto] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [filterVille, setFilterVille] = useState<string>("all");
  const [filterCategorie, setFilterCategorie] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [maisonsData, referencesData] = await Promise.all([
        fetchMaisons(),
        fetchMaisonReferences(),
      ]);
      setMaisons(maisonsData);
      setReferences(referencesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les maisons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const villes = useMemo(() => {
    return [...new Set(maisons.map((maison) => maison.ville?.trim()).filter(Boolean) as string[])].sort(
      (a, b) => a.localeCompare(b, "fr")
    );
  }, [maisons]);

  const categories = useMemo(() => {
    return [
      ...new Set(maisons.map((maison) => maison.categorie?.trim()).filter(Boolean) as string[]),
    ].sort((a, b) => a.localeCompare(b, "fr"));
  }, [maisons]);

  const filteredMaisons = useMemo(() => {
    const query = search.trim().toLowerCase();

    return maisons.filter((maison) => {
      if (filterStatut !== "all" && maison.statut !== filterStatut) {
        return false;
      }

      if (filterVille !== "all" && (maison.ville || "") !== filterVille) {
        return false;
      }

      if (filterCategorie !== "all" && (maison.categorie || "") !== filterCategorie) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        maison.nom,
        maison.ville,
        maison.categorie,
        maison.adresse,
        maison.quartier,
        maison.email,
        maison.telephone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [maisons, search, filterStatut, filterVille, filterCategorie]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = async (maison: { id: number }) => {
    setFormError(null);
    setLoadingForm(true);
    setDialogOpen(true);

    try {
      const detail = await fetchMaison(maison.id);
      setEditingId(detail.id);
      setForm(toFormState(detail));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Impossible de charger la maison.");
    } finally {
      setLoadingForm(false);
    }
  };

  const openViewDialog = async (maison: MaisonListItem) => {
    setViewMaison(null);
    setLoadingView(true);
    setViewOpen(true);

    try {
      const detail = await fetchMaison(maison.id);
      setViewMaison(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger la fiche.");
      setViewOpen(false);
    } finally {
      setLoadingView(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    if (uploadingPhotoIndex !== null) {
      setFormError("Veuillez attendre la fin de l'envoi des photos.");
      setSaving(false);
      return;
    }

    const payload = toPayload(form);

    if (!payload.nom) {
      setFormError("Le nom est obligatoire.");
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await updateMaison(editingId, payload);
      } else {
        await createMaison(payload);
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Impossible d'enregistrer la maison.");
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
      await deleteMaison(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer la maison.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handlePhotoUpload = async (index: number, file?: File | null) => {
    if (!file) {
      return;
    }

    setUploadingPhotoIndex(index);
    setFormError(null);

    const localPreview = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.map((item, i) =>
        i === index ? { ...item, url: localPreview } : item
      ),
    }));

    try {
      const url = await uploadMaisonPhoto(file);
      setForm((prev) => ({
        ...prev,
        photos: prev.photos.map((item, i) => (i === index ? { ...item, url } : item)),
      }));
      URL.revokeObjectURL(localPreview);
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setForm((prev) => ({
        ...prev,
        photos: prev.photos.map((item, i) =>
          i === index ? { ...item, url: "" } : item
        ),
      }));
      setFormError(err instanceof Error ? err.message : "Impossible d'envoyer la photo.");
    } finally {
      setUploadingPhotoIndex(null);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 lg:block">
          <h2 className="hidden text-[22px] font-semibold tracking-tight text-slate-900 lg:block">
            Maisons d&apos;hôtes
          </h2>
          <p className="text-[13px] text-slate-500 lg:mt-1">
            Créer, modifier et supprimer les maisons d&apos;hôtes et leurs détails.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreateDialog}
          className="w-full rounded-xl bg-[#3b82f6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#2563eb] sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Ajouter une maison
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:mt-5 sm:rounded-[22px] sm:p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une maison..."
            className="pl-9"
          />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="actif">Actif</SelectItem>
            <SelectItem value="inactif">Inactif</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterVille} onValueChange={setFilterVille}>
          <SelectTrigger>
            <SelectValue placeholder="Ville" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les villes</SelectItem>
            {villes.map((ville) => (
              <SelectItem key={ville} value={ville}>
                {ville}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategorie} onValueChange={setFilterCategorie}>
          <SelectTrigger>
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((categorie) => (
              <SelectItem key={categorie} value={categorie}>
                {categorie}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        {loading ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">Chargement des maisons...</p>
        ) : maisons.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">Aucune maison d&apos;hôtes trouvée.</p>
        ) : filteredMaisons.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">
            Aucun résultat pour cette recherche ou ces filtres.
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-[#fbfcff]">
              <TableRow>
                <TableHead className="text-[12px] font-semibold text-slate-400">Nom</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Ville</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Chambres</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-400">Statut</TableHead>
                <TableHead className="text-right text-[12px] font-semibold text-slate-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaisons.map((maison) => (
                <TableRow key={maison.id}>
                  <TableCell className="text-[13px] font-medium text-slate-800">
                    <div className="flex items-center gap-3">
                      {maison.photo_principale ? (
                        <ZoomableImage
                          src={maison.photo_principale}
                          alt={maison.nom}
                          className="h-10 w-10 rounded-lg"
                          onPreview={setHoveredPhoto}
                        />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] text-slate-400">
                          N/A
                        </div>
                      )}
                      <div>
                        <p>{maison.nom}</p>
                        <p className="text-[11px] text-slate-400">{maison.categorie || "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {maison.ville || "—"}
                  </TableCell>
                  <TableCell className="text-[13px] text-slate-500">
                    {maison.nb_chambres}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statutBadgeClass(maison.statut)}`}
                    >
                      {STATUT_LABELS[maison.statut] || maison.statut}
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
                          aria-label="Actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onClick={() => void openViewDialog(maison)}
                        >
                          <Eye className="h-4 w-4" />
                          Voir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onClick={() => void openEditDialog(maison)}
                        >
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-red-600 focus:bg-red-50 focus:text-red-700"
                          onClick={() => setDeleteTarget(maison)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier la maison d'hôtes" : "Ajouter une maison d'hôtes"}
            </DialogTitle>
          </DialogHeader>

          {loadingForm ? (
            <p className="py-8 text-[13px] text-slate-500">Chargement...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Informations générales</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="maison-nom">Nom *</Label>
                    <Input
                      id="maison-nom"
                      value={form.nom}
                      onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="maison-description">Description</Label>
                    <Textarea
                      id="maison-description"
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-categorie">Catégorie</Label>
                    <Input
                      id="maison-categorie"
                      value={form.categorie}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, categorie: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Statut</Label>
                    <Select
                      value={form.statut}
                      onValueChange={(value: MaisonStatut) =>
                        setForm((prev) => ({ ...prev, statut: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en_attente">En attente</SelectItem>
                        <SelectItem value="actif">Actif</SelectItem>
                        <SelectItem value="inactif">Inactif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-chambres">Nombre de chambres</Label>
                    <Input
                      id="maison-chambres"
                      type="number"
                      min="0"
                      value={form.nb_chambres}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, nb_chambres: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-taxe-sejour">
                      Taxe de séjour (par nuit / adulte)
                    </Label>
                    <Input
                      id="maison-taxe-sejour"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.taxe_de_sejour}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, taxe_de_sejour: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-3 sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="maison-lits-bebe"
                        checked={form.lits_bebe_disponibles}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            lits_bebe_disponibles: checked === true,
                            nb_lits_bebe:
                              checked === true
                                ? prev.nb_lits_bebe === "0"
                                  ? "1"
                                  : prev.nb_lits_bebe
                                : "0",
                          }))
                        }
                      />
                      <Label htmlFor="maison-lits-bebe" className="cursor-pointer font-medium">
                        Lits bébé disponibles
                      </Label>
                    </div>
                    {form.lits_bebe_disponibles ? (
                      <div className="space-y-2 pl-6">
                        <Label htmlFor="maison-nb-lits-bebe">Nombre de lits bébé</Label>
                        <Input
                          id="maison-nb-lits-bebe"
                          type="number"
                          min="1"
                          className="max-w-xs"
                          value={form.nb_lits_bebe}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              nb_lits_bebe: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-checkin">Heure check-in</Label>
                    <Input
                      id="maison-checkin"
                      type="time"
                      value={form.heure_checkin}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, heure_checkin: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-checkout">Heure check-out</Label>
                    <Input
                      id="maison-checkout"
                      type="time"
                      value={form.heure_checkout}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, heure_checkout: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Localisation & contact</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="maison-adresse">Adresse</Label>
                    <Input
                      id="maison-adresse"
                      value={form.adresse}
                      onChange={(e) => setForm((prev) => ({ ...prev, adresse: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-quartier">Quartier</Label>
                    <Input
                      id="maison-quartier"
                      value={form.quartier}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, quartier: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-ville">Ville</Label>
                    <Input
                      id="maison-ville"
                      value={form.ville}
                      onChange={(e) => setForm((prev) => ({ ...prev, ville: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-cp">Code postal</Label>
                    <Input
                      id="maison-cp"
                      value={form.code_postal}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, code_postal: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-pays">Pays</Label>
                    <Input
                      id="maison-pays"
                      value={form.pays}
                      onChange={(e) => setForm((prev) => ({ ...prev, pays: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-lat">Latitude</Label>
                    <Input
                      id="maison-lat"
                      value={form.latitude}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, latitude: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-lng">Longitude</Label>
                    <Input
                      id="maison-lng"
                      value={form.longitude}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, longitude: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-tel">Téléphone</Label>
                    <Input
                      id="maison-tel"
                      value={form.telephone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, telephone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-whatsapp">WhatsApp</Label>
                    <Input
                      id="maison-whatsapp"
                      value={form.whatsapp}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, whatsapp: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-email">Email</Label>
                    <Input
                      id="maison-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-web">Site web</Label>
                    <Input
                      id="maison-web"
                      value={form.site_web}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, site_web: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Administratif</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maison-devise">Devise</Label>
                    <Input
                      id="maison-devise"
                      value={form.devise}
                      onChange={(e) => setForm((prev) => ({ ...prev, devise: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-tva">Taux TVA (%)</Label>
                    <Input
                      id="maison-tva"
                      type="number"
                      step="0.01"
                      value={form.taux_tva}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, taux_tva: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-patente">N° patente</Label>
                    <Input
                      id="maison-patente"
                      value={form.numero_patente}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, numero_patente: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maison-ice">N° ICE</Label>
                    <Input
                      id="maison-ice"
                      value={form.numero_ice}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, numero_ice: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="maison-classement">N° classement</Label>
                    <Input
                      id="maison-classement"
                      value={form.numero_classement}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, numero_classement: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Services</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {references.services.map((service) => (
                    <label
                      key={service.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                    >
                      <Checkbox
                        checked={form.service_ids.includes(service.id)}
                        onCheckedChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            service_ids: toggleId(prev.service_ids, service.id),
                          }))
                        }
                      />
                      {service.nom}
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Équipements</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {references.equipements.map((equipement) => (
                    <label
                      key={equipement.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                    >
                      <Checkbox
                        checked={form.equipement_ids.includes(equipement.id)}
                        onCheckedChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            equipement_ids: toggleId(prev.equipement_ids, equipement.id),
                          }))
                        }
                      />
                      {equipement.nom}
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Langues</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {references.langues.map((langue) => (
                    <label
                      key={langue.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                    >
                      <Checkbox
                        checked={form.langue_ids.includes(langue.id)}
                        onCheckedChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            langue_ids: toggleId(prev.langue_ids, langue.id),
                          }))
                        }
                      />
                      {langue.nom}
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Photos</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        photos: [
                          ...prev.photos,
                          {
                            url: "",
                            legende: "",
                            est_principale: prev.photos.length === 0,
                            ordre: prev.photos.length,
                          },
                        ],
                      }))
                    }
                  >
                    Ajouter une photo
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.photos.map((photo, index) => (
                    <div
                      key={`photo-${index}`}
                      className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[96px_1fr_auto_auto]"
                    >
                      <label className="relative flex h-20 w-24 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-slate-400 hover:bg-slate-100">
                        {photo.url ? (
                          <img
                            src={resolvePhotoUrl(photo.url)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <>
                            <ImagePlus className="h-5 w-5" />
                            <span className="mt-1 text-[10px] font-medium">Choisir</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          disabled={uploadingPhotoIndex === index}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            void handlePhotoUpload(index, file);
                            e.target.value = "";
                          }}
                        />
                      </label>

                      <div className="min-w-0 space-y-2">
                        <div className="space-y-1">
                          <Label htmlFor={`photo-url-${index}`} className="text-[12px] text-slate-500">
                            URL de la photo
                          </Label>
                          <Input
                            id={`photo-url-${index}`}
                            type="text"
                            placeholder="Choisissez une image ou collez une URL"
                            value={photo.url.startsWith("blob:") ? "" : photo.url}
                            readOnly={uploadingPhotoIndex === index}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                photos: prev.photos.map((item, i) =>
                                  i === index ? { ...item, url: e.target.value } : item
                                ),
                              }))
                            }
                          />
                        </div>
                        <Input
                          placeholder="Légende"
                          value={photo.legende || ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              photos: prev.photos.map((item, i) =>
                                i === index ? { ...item, legende: e.target.value } : item
                              ),
                            }))
                          }
                        />
                        {uploadingPhotoIndex === index ? (
                          <p className="text-[11px] text-slate-500">Envoi de la photo...</p>
                        ) : photo.url && !photo.url.startsWith("blob:") ? (
                          <p className="truncate text-[11px] text-emerald-600">{photo.url}</p>
                        ) : null}
                      </div>

                      <label className="flex items-center gap-2 text-[12px] text-slate-600">
                        <Checkbox
                          checked={Boolean(photo.est_principale)}
                          onCheckedChange={(checked) =>
                            setForm((prev) => ({
                              ...prev,
                              photos: prev.photos.map((item, i) => ({
                                ...item,
                                est_principale: i === index ? Boolean(checked) : false,
                              })),
                            }))
                          }
                        />
                        Principale
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        disabled={form.photos.length === 1}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            photos: prev.photos.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        Retirer
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Horaires</h3>
                <div className="space-y-2">
                  {form.horaires.map((horaire, index) => (
                    <div
                      key={horaire.jour_semaine}
                      className="grid items-center gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[100px_1fr_1fr_auto]"
                    >
                      <p className="text-[13px] font-medium capitalize text-slate-700">
                        {horaire.jour_semaine}
                      </p>
                      <Input
                        type="time"
                        disabled={horaire.ferme}
                        value={horaire.heure_ouverture || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            horaires: prev.horaires.map((item, i) =>
                              i === index
                                ? { ...item, heure_ouverture: e.target.value }
                                : item
                            ),
                          }))
                        }
                      />
                      <Input
                        type="time"
                        disabled={horaire.ferme}
                        value={horaire.heure_fermeture || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            horaires: prev.horaires.map((item, i) =>
                              i === index
                                ? { ...item, heure_fermeture: e.target.value }
                                : item
                            ),
                          }))
                        }
                      />
                      <label className="flex items-center gap-2 text-[12px] text-slate-600">
                        <Checkbox
                          checked={Boolean(horaire.ferme)}
                          onCheckedChange={(checked) =>
                            setForm((prev) => ({
                              ...prev,
                              horaires: prev.horaires.map((item, i) =>
                                i === index ? { ...item, ferme: Boolean(checked) } : item
                              ),
                            }))
                          }
                        />
                        Fermé
                      </label>
                    </div>
                  ))}
                </div>
              </section>

              {formError && <p className="text-[13px] text-red-600">{formError}</p>}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {hoveredPhoto ? (
        <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-6">
          <img
            src={hoveredPhoto}
            alt=""
            className="max-h-[70vh] max-w-[min(70vw,28rem)] rounded-2xl object-contain shadow-2xl ring-4 ring-white"
          />
        </div>
      ) : null}

      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) {
            setHoveredPhoto(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Fiche de la maison d&apos;hôtes</DialogTitle>
          </DialogHeader>

          {loadingView ? (
            <p className="py-8 text-[13px] text-slate-500">Chargement de la fiche...</p>
          ) : viewMaison ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {viewMaison.photos[0] || viewMaison.photo_principale ? (
                  <ZoomableImage
                    src={
                      viewMaison.photos.find((photo) => photo.est_principale)?.url ||
                      viewMaison.photos[0]?.url ||
                      viewMaison.photo_principale ||
                      ""
                    }
                    alt={viewMaison.nom}
                    className="h-40 w-full rounded-2xl sm:h-36 sm:w-48"
                    onPreview={setHoveredPhoto}
                  />
                ) : (
                  <div className="grid h-36 w-full place-items-center rounded-2xl bg-slate-100 text-sm text-slate-400 sm:w-48">
                    Aucune photo
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-slate-900">{viewMaison.nom}</h3>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statutBadgeClass(viewMaison.statut)}`}
                    >
                      {STATUT_LABELS[viewMaison.statut] || viewMaison.statut}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {viewMaison.categorie || "Sans catégorie"}
                  </p>
                  {viewMaison.description ? (
                    <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                      {viewMaison.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <InfoItem label="Ville" value={viewMaison.ville} />
                <InfoItem label="Quartier" value={viewMaison.quartier} />
                <InfoItem label="Adresse" value={viewMaison.adresse} />
                <InfoItem
                  label="Code postal"
                  value={[viewMaison.code_postal, viewMaison.pays].filter(Boolean).join(" · ")}
                />
                <InfoItem label="Chambres" value={viewMaison.nb_chambres} />
                <InfoItem
                  label="Lits bébé"
                  value={
                    viewMaison.lits_bebe_disponibles
                      ? `${viewMaison.nb_lits_bebe} disponible${
                          Number(viewMaison.nb_lits_bebe) > 1 ? "s" : ""
                        }`
                      : "Non"
                  }
                />
                <InfoItem
                  label="Check-in"
                  value={formatTimeDisplay(viewMaison.heure_checkin)}
                />
                <InfoItem
                  label="Check-out"
                  value={formatTimeDisplay(viewMaison.heure_checkout)}
                />
              </section>

              <section className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
                <InfoItem label="Téléphone" value={viewMaison.telephone} />
                <InfoItem label="WhatsApp" value={viewMaison.whatsapp} />
                <InfoItem label="Email" value={viewMaison.email} />
                <InfoItem label="Site web" value={viewMaison.site_web} />
                <InfoItem label="Devise" value={viewMaison.devise} />
                <InfoItem label="Taux TVA" value={viewMaison.taux_tva} />
                <InfoItem
                  label="Taxe de séjour"
                  value={
                    viewMaison.taxe_de_sejour != null
                      ? `${Number(viewMaison.taxe_de_sejour).toLocaleString("fr-FR")} / nuit / adulte (enfants < 12 ans exonérés)`
                      : "—"
                  }
                />
                <InfoItem label="N° patente" value={viewMaison.numero_patente} />
                <InfoItem label="N° ICE" value={viewMaison.numero_ice} />
                <InfoItem label="N° classement" value={viewMaison.numero_classement} />
                <InfoItem label="Note moyenne" value={viewMaison.note_moyenne} />
              </section>

              {viewMaison.services.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Services</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewMaison.services.map((service) => (
                      <span
                        key={service.id}
                        className="rounded-full bg-[#eff6ff] px-3 py-1 text-[12px] font-medium text-[#1d4ed8]"
                      >
                        {service.nom}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {viewMaison.equipements.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Équipements</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewMaison.equipements.map((equipement) => (
                      <span
                        key={equipement.id}
                        className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-700"
                      >
                        {equipement.nom}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {viewMaison.langues.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Langues</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewMaison.langues.map((langue) => (
                      <span
                        key={langue.id}
                        className="rounded-full bg-violet-50 px-3 py-1 text-[12px] font-medium text-violet-700"
                      >
                        {langue.nom}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {viewMaison.photos.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Photos</h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {viewMaison.photos.map((photo, index) => (
                      <div key={photo.id || index} className="overflow-hidden rounded-xl border border-slate-200">
                        <ZoomableImage
                          src={photo.url}
                          alt={photo.legende || viewMaison.nom}
                          className="h-28 w-full"
                          onPreview={setHoveredPhoto}
                        />
                        {photo.legende ? (
                          <p className="px-2 py-1.5 text-[11px] text-slate-500">{photo.legende}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {viewMaison.horaires.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Horaires</h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    {viewMaison.horaires.map((horaire) => (
                      <div
                        key={horaire.jour_semaine}
                        className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-[13px] last:border-b-0"
                      >
                        <span className="capitalize font-medium text-slate-700">
                          {horaire.jour_semaine}
                        </span>
                        <span className="text-slate-500">
                          {horaire.ferme
                            ? "Fermé"
                            : `${formatTimeDisplay(horaire.heure_ouverture)} - ${formatTimeDisplay(horaire.heure_fermeture)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>
                  Fermer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setViewOpen(false);
                    if (viewMaison) {
                      void openEditDialog(viewMaison);
                    }
                  }}
                >
                  Modifier
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <p className="py-8 text-[13px] text-slate-500">Maison introuvable.</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette maison d&apos;hôtes ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La maison{" "}
              <strong>{deleteTarget?.nom}</strong> et toutes ses données liées seront
              supprimées.
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
