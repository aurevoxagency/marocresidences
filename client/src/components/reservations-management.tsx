import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
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
import { fetchClients, type Client } from "@/lib/clients";
import {
  fetchChambres,
  fetchSaisons,
  fetchSupplementTarifs,
  fetchTranchesAge,
  type ChambreListItem,
  type Saison,
  type SupplementTarifRow,
  type TrancheAge,
} from "@/lib/hebergement";
import { fetchMaisons, fetchMaison, resolvePhotoUrl, type MaisonDetail, type MaisonListItem } from "@/lib/maisons";
import { downloadReservationSheetPdf } from "@/lib/reservation-sheet-pdf";
import { fetchPromotions, type Promotion } from "@/lib/promotions";
import {
  calculateChambreStayTotal,
  calculateBebeStayTotal,
  calculateEnfantStayTotal,
  calculateEnfantsStayTotalFromAges,
  calculateOccupantSupplementStayTotal,
  findTrancheTarifForAge,
  getBebeTranche,
  getEnfantAgeOptions,
  calculateNights,
  calculateReservationTotals,
  computeMontantReduction,
  countTaxeSejourAssujettis,
  createReservation,
  deleteReservation,
  fetchReservation,
  fetchReservations,
  resolveTrancheAgeId,
  updateReservation,
  type Reservation,
  type ReservationFormData,
  type ReservationOccupantFormData,
  type ReservationOccupantType,
  type ReservationSource,
  type ReservationStatut,
  type ReservationStatutPaiement,
  type ReservationTypeReduction,
} from "@/lib/reservations";

function findSaisonForDate(saisons: Saison[], date?: string) {
  if (!date) {
    return saisons[0]?.id;
  }

  const day = toDateOnlyLocal(date);

  const match = saisons.find((saison) => {
    const start = toDateOnlyLocal(saison.date_debut);
    const end = toDateOnlyLocal(saison.date_fin);
    return Boolean(start && end && day >= start && day <= end);
  });

  return match?.id ?? saisons[0]?.id;
}

type PromotionDiscount = {
  type_reduction: "pourcentage" | "valeur";
  valeur_reduction: number;
};

function resolveFormPromotion(
  promotionId: string,
  promotionsList: Promotion[]
): PromotionDiscount | null {
  if (!promotionId) {
    return null;
  }

  const promotion = promotionsList.find((item) => String(item.id) === promotionId);

  if (!promotion) {
    return null;
  }

  return {
    type_reduction: promotion.type_reduction,
    valeur_reduction: Number(promotion.valeur_reduction),
  };
}

function getChambrePriceTotal(
  chambreId: string,
  nights: number,
  chambreList: ChambreListItem[],
  promotion?: PromotionDiscount | null
) {
  const chambre = chambreList.find((item) => String(item.id) === chambreId);

  if (!chambre) {
    return null;
  }

  return calculateChambreStayTotal(chambre.prix_adulte, nights, promotion);
}

function getEnfantsPriceTotal(
  chambreId: string,
  nights: number,
  chambreList: ChambreListItem[],
  ages: number[],
  promotion?: PromotionDiscount | null
) {
  const chambre = chambreList.find((item) => String(item.id) === chambreId);

  if (!chambre || ages.length === 0) {
    return ages.length === 0 ? 0 : null;
  }

  return calculateEnfantsStayTotalFromAges(chambre, nights, ages, promotion);
}

function getBebePriceTotal(
  chambreId: string,
  nights: number,
  chambreList: ChambreListItem[],
  promotion?: PromotionDiscount | null
) {
  const chambre = chambreList.find((item) => String(item.id) === chambreId);

  if (!chambre) {
    return null;
  }

  return calculateBebeStayTotal(chambre, nights, promotion);
}

function scalePriceByCount(total: number | null, count: number) {
  if (count <= 0) {
    return 0;
  }

  if (total == null) {
    return null;
  }

  return Math.round(total * count * 100) / 100;
}

function applyChambrePricing(
  chambreId: string,
  nights: number,
  chambreList: ChambreListItem[],
  counts?: {
    nb_adultes?: number;
    nbrs_enfants?: number;
    nbrs_bebe?: number;
    enfant_ages?: number[];
  },
  promotion?: PromotionDiscount | null
) {
  const nbAdultes = Math.max(1, counts?.nb_adultes ?? 1);
  const nbrsEnfants = Math.max(0, counts?.nbrs_enfants ?? 0);
  const nbrsBebe = Math.max(0, counts?.nbrs_bebe ?? 0);
  const enfantAges = (counts?.enfant_ages || []).filter((age) => age >= 0);

  return {
    prix_chambre_total: scalePriceByCount(
      getChambrePriceTotal(chambreId, nights, chambreList, promotion),
      nbAdultes
    ),
    prix_bebe_total: scalePriceByCount(
      getBebePriceTotal(chambreId, nights, chambreList, promotion),
      nbrsBebe
    ),
    prix_enfants_total:
      nbrsEnfants > 0
        ? getEnfantsPriceTotal(chambreId, nights, chambreList, enfantAges, promotion)
        : 0,
  };
}

type OccupantFormState = {
  key: string;
  type_occupant: ReservationOccupantType;
  nom: string;
  prenom: string;
  age_enfant: string;
  tranche_age_id: string;
  supplement_id: string;
  date_naissance: string;
  piece_identite: string;
};

function emptyOccupant(
  type: ReservationOccupantType,
  index: number,
  seed?: Partial<OccupantFormState>
): OccupantFormState {
  return {
    key: `${type}-${index}-${seed?.key || "new"}`,
    type_occupant: type,
    nom: seed?.nom || "",
    prenom: seed?.prenom || "",
    age_enfant: seed?.age_enfant || "",
    tranche_age_id: seed?.tranche_age_id || "",
    supplement_id: seed?.supplement_id || "",
    date_naissance: seed?.date_naissance || "",
    piece_identite: seed?.piece_identite || "",
  };
}

function buildOccupantsFromCounts(
  nbAdultes: number,
  nbrsEnfants: number,
  nbrsBebe: number,
  existing: OccupantFormState[] = []
) {
  const adults = existing.filter((item) => item.type_occupant === "adulte");
  const children = existing.filter((item) => item.type_occupant === "enfant");
  const babies = existing.filter((item) => item.type_occupant === "bebe");
  const next: OccupantFormState[] = [];

  for (let index = 0; index < nbAdultes; index += 1) {
    next.push(emptyOccupant("adulte", index, adults[index]));
  }

  for (let index = 0; index < nbrsEnfants; index += 1) {
    next.push(emptyOccupant("enfant", index, children[index]));
  }

  for (let index = 0; index < nbrsBebe; index += 1) {
    next.push(emptyOccupant("bebe", index, babies[index]));
  }

  return next;
}

function occupantsFromReservation(
  reservation: Reservation,
  tranches: TrancheAge[]
): OccupantFormState[] {
  if (reservation.occupants && reservation.occupants.length > 0) {
    return reservation.occupants.map((occupant, index) =>
      emptyOccupant(occupant.type_occupant, index, {
        key: String(occupant.id ?? index),
        nom: occupant.nom || "",
        prenom: occupant.prenom || "",
        age_enfant:
          occupant.age_enfant != null && occupant.age_enfant >= 0
            ? String(occupant.age_enfant)
            : "",
        tranche_age_id: occupant.tranche_age_id ? String(occupant.tranche_age_id) : "",
        supplement_id: occupant.supplement_id ? String(occupant.supplement_id) : "",
        date_naissance: dateInput(occupant.date_naissance),
        piece_identite: occupant.piece_identite || "",
      })
    );
  }

  const seededChildren =
    reservation.nbrs_enfants > 0 && reservation.age_enfant
      ? Array.from({ length: reservation.nbrs_enfants }, (_, index) =>
          emptyOccupant("enfant", index, {
            age_enfant: String(reservation.age_enfant),
            tranche_age_id: String(
              resolveTrancheAgeId(tranches, reservation.age_enfant) || ""
            ),
          })
        )
      : [];

  return buildOccupantsFromCounts(
    reservation.nb_adultes,
    reservation.nbrs_enfants,
    reservation.nbrs_bebe,
    seededChildren
  );
}

const SOURCE_LABELS: Record<ReservationSource, string> = {
  site_web: "Site web",
  booking: "Booking",
  airbnb: "Airbnb",
  agence: "Agence",
  telephone: "Téléphone",
  walk_in: "Walk-in",
  autre: "Autre",
};

const STATUT_LABELS: Record<ReservationStatut, string> = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  annulee: "Annulée",
  terminee: "Terminée",
  no_show: "No-show",
};

const PAIEMENT_LABELS: Record<ReservationStatutPaiement, string> = {
  non_paye: "Non payé",
  acompte_paye: "Acompte payé",
  paye_totalement: "Payé totalement",
  rembourse: "Remboursé",
};

type FormState = {
  client_id: string;
  maison_id: string;
  chambre_id: string;
  date_arrivee: string;
  date_depart: string;
  nb_adultes: string;
  nbrs_enfants: string;
  nbrs_bebe: string;
  lit_bebe: boolean;
  source: ReservationSource;
  promotion_id: string;
  supplement_id: string;
  prix_chambre_total: string;
  prix_bebe_total: string;
  prix_enfants_total: string;
  type_reduction: "" | ReservationTypeReduction;
  valeur_reduction: string;
  taux_tva_applique: string;
  statut_reservation: ReservationStatut;
  statut_paiement: ReservationStatutPaiement;
  montant_paye: string;
  notes: string;
};

function emptyForm(maisonId = ""): FormState {
  return {
    client_id: "",
    maison_id: maisonId,
    chambre_id: "",
    date_arrivee: "",
    date_depart: "",
    nb_adultes: "1",
    nbrs_enfants: "0",
    nbrs_bebe: "0",
    lit_bebe: false,
    source: "autre",
    promotion_id: "",
    supplement_id: "",
    prix_chambre_total: "0",
    prix_bebe_total: "0",
    prix_enfants_total: "0",
    type_reduction: "",
    valeur_reduction: "0",
    taux_tva_applique: "10",
    statut_reservation: "en_attente",
    statut_paiement: "non_paye",
    montant_paye: "0",
    notes: "",
  };
}

function toDateOnlyLocal(value?: string | Date | null) {
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

  // Already a calendar date (yyyy-mm-dd)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  // ISO / MySQL datetime — convert with local timezone (avoid UTC slice off-by-one)
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return raw.slice(0, 10);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateInput(value?: string | null) {
  return toDateOnlyLocal(value);
}

function formatMoney(value?: number | string | null) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function toFormState(reservation: Reservation): FormState {
  return {
    client_id: String(reservation.client_id),
    maison_id: String(reservation.maison_id),
    chambre_id: String(reservation.chambre_id),
    date_arrivee: dateInput(reservation.date_arrivee),
    date_depart: dateInput(reservation.date_depart),
    nb_adultes: String(reservation.nb_adultes),
    nbrs_enfants: String(reservation.nbrs_enfants ?? 0),
    nbrs_bebe: String(reservation.nbrs_bebe ?? 0),
    lit_bebe: Boolean(reservation.lit_bebe === true || reservation.lit_bebe === 1),
    source: reservation.source,
    promotion_id: reservation.promotion_id ? String(reservation.promotion_id) : "",
    supplement_id: reservation.supplement_id ? String(reservation.supplement_id) : "",
    prix_chambre_total: String(reservation.prix_chambre_total ?? 0),
    prix_bebe_total: String(reservation.prix_bebe_total ?? 0),
    prix_enfants_total: String(reservation.prix_enfants_total),
    type_reduction: reservation.type_reduction || "",
    valeur_reduction: String(reservation.valeur_reduction ?? 0),
    taux_tva_applique: String(reservation.taux_tva_applique),
    statut_reservation: reservation.statut_reservation,
    statut_paiement: reservation.statut_paiement,
    montant_paye: String(reservation.montant_paye),
    notes: reservation.notes || "",
  };
}

function formatDateDisplay(value?: string | null) {
  const iso = toDateOnlyLocal(value);

  if (!iso) {
    return "—";
  }

  const date = new Date(`${iso}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function FicheInfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

function getMaisonHeroPhoto(maison: MaisonDetail | MaisonListItem) {
  if ("photos" in maison && maison.photos.length > 0) {
    const principale = maison.photos.find((photo) => photo.est_principale);

    return principale?.url || maison.photos[0]?.url || maison.photo_principale || "";
  }

  return maison.photo_principale || "";
}

function statutBadgeVariant(statut: ReservationStatut) {
  if (statut === "confirmee" || statut === "terminee") {
    return "default" as const;
  }

  if (statut === "annulee" || statut === "no_show") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export function ReservationsManagement() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [chambres, setChambres] = useState<ChambreListItem[]>([]);
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [supplements, setSupplements] = useState<SupplementTarifRow[]>([]);
  const [tranchesAge, setTranchesAge] = useState<TrancheAge[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filterMaison, setFilterMaison] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formStep, setFormStep] = useState<"details" | "occupants">("details");
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [occupants, setOccupants] = useState<OccupantFormState[]>(() =>
    buildOccupantsFromCounts(1, 0, 0)
  );
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [viewReservation, setViewReservation] = useState<Reservation | null>(null);
  const [viewMaison, setViewMaison] = useState<MaisonDetail | null>(null);
  const [loadingViewSheet, setLoadingViewSheet] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);
  const [showConfirmFloatingBtn, setShowConfirmFloatingBtn] = useState(false);
  const [confirmingReservation, setConfirmingReservation] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Reservation | null>(null);
  const viewSheetScrollRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [reservationsData, clientsData, maisonsData] = await Promise.all([
        fetchReservations(),
        fetchClients(),
        fetchMaisons(),
      ]);

      setReservations(reservationsData);
      setClients(clientsData);
      setMaisons(maisonsData);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de charger les réservations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void fetchTranchesAge()
      .then(setTranchesAge)
      .catch(() => setTranchesAge([]));
  }, []);

  const loadSupplements = useCallback(async (maisonId: number) => {
    if (!maisonId) {
      setSupplements([]);
      return;
    }

    try {
      const data = await fetchSupplementTarifs(maisonId);
      setSupplements(data.supplements.filter((supplement) => supplement.statut === "actif"));
    } catch {
      setSupplements([]);
    }
  }, []);

  const loadChambres = useCallback(async (maisonId: number, dateArrivee?: string) => {
    if (!maisonId) {
      setChambres([]);
      setSaisons([]);
      return [];
    }

    try {
      const saisonsData = await fetchSaisons(maisonId);
      setSaisons(saisonsData);

      const saisonId = findSaisonForDate(saisonsData, dateArrivee);
      const data = await fetchChambres(maisonId, saisonId);
      const activeChambres = data.filter((chambre) => chambre.statut === "actif");
      setChambres(activeChambres);
      return activeChambres;
    } catch {
      setChambres([]);
      return [];
    }
  }, []);

  const loadPromotions = useCallback(async (maisonId: number) => {
    if (!maisonId) {
      setPromotions([]);
      return;
    }

    try {
      const data = await fetchPromotions(maisonId);
      setPromotions(data.filter((promotion) => promotion.statut === "active"));
    } catch {
      setPromotions([]);
    }
  }, []);

  const nbNuits = useMemo(
    () => calculateNights(form.date_arrivee, form.date_depart),
    [form.date_arrivee, form.date_depart]
  );

  const nbAdultes = Math.max(1, Number(form.nb_adultes) || 1);
  const nbrsEnfants = Math.max(0, Number(form.nbrs_enfants) || 0);
  const nbrsBebe = Math.max(0, Number(form.nbrs_bebe) || 0);
  const enfantAges = useMemo(
    () =>
      occupants
        .filter((item) => item.type_occupant === "enfant" && item.age_enfant !== "")
        .map((item) => Number(item.age_enfant))
        .filter((age) => Number.isFinite(age) && age >= 0),
    [occupants]
  );
  const ageEnfant = enfantAges[0];

  const selectedChambre = useMemo(
    () => chambres.find((item) => String(item.id) === form.chambre_id),
    [chambres, form.chambre_id]
  );

  const enfantAgeOptions = useMemo(
    () => (selectedChambre ? getEnfantAgeOptions(selectedChambre) : []),
    [selectedChambre]
  );

  const selectedPromotion = useMemo(
    () => resolveFormPromotion(form.promotion_id, promotions),
    [form.promotion_id, promotions]
  );

  const saisonId = useMemo(
    () => findSaisonForDate(saisons, form.date_arrivee),
    [saisons, form.date_arrivee]
  );

  const getOccupantSupplementAmount = useCallback(
    (occupant: OccupantFormState) => {
      if (!occupant.supplement_id) {
        return 0;
      }

      const supplement = supplements.find(
        (item) => String(item.id) === occupant.supplement_id
      );

      return calculateOccupantSupplementStayTotal(
        supplement,
        saisonId,
        occupant.type_occupant,
        occupant.age_enfant ? Number(occupant.age_enfant) : null,
        nbNuits,
        tranchesAge,
        selectedPromotion
      );
    },
    [supplements, saisonId, nbNuits, tranchesAge, selectedPromotion]
  );

  const supplementTotal = useMemo(
    () =>
      occupants.reduce(
        (total, occupant) => total + getOccupantSupplementAmount(occupant),
        0
      ),
    [occupants, getOccupantSupplementAmount]
  );

  useEffect(() => {
    const maisonId = Number(form.maison_id);
    if (!maisonId) {
      setPromotions([]);
      return;
    }

    void loadPromotions(maisonId);
  }, [form.maison_id, loadPromotions]);

  useEffect(() => {
    const maisonId = Number(form.maison_id);
    if (!maisonId) {
      setChambres([]);
      setSaisons([]);
      return;
    }

    void loadChambres(maisonId, form.date_arrivee);
    void loadSupplements(maisonId);
  }, [form.maison_id, form.date_arrivee, loadChambres, loadSupplements]);

  useEffect(() => {
    if (!form.chambre_id || chambres.length === 0) {
      return;
    }

    const pricing = applyChambrePricing(
      form.chambre_id,
      nbNuits,
      chambres,
      {
        nb_adultes: nbAdultes,
        nbrs_enfants: nbrsEnfants,
        nbrs_bebe: nbrsBebe,
        enfant_ages: enfantAges,
      },
      selectedPromotion
    );

    setForm((current) => {
      const next = { ...current };
      let changed = false;

      if (
        pricing.prix_chambre_total != null &&
        current.prix_chambre_total !== String(pricing.prix_chambre_total)
      ) {
        next.prix_chambre_total = String(pricing.prix_chambre_total);
        changed = true;
      }

      if (
        pricing.prix_bebe_total != null &&
        current.prix_bebe_total !== String(pricing.prix_bebe_total)
      ) {
        next.prix_bebe_total = String(pricing.prix_bebe_total);
        changed = true;
      }

      if (
        pricing.prix_enfants_total != null &&
        current.prix_enfants_total !== String(pricing.prix_enfants_total)
      ) {
        next.prix_enfants_total = String(pricing.prix_enfants_total);
        changed = true;
      }

      return changed ? next : current;
    });
  }, [
    form.chambre_id,
    form.nb_adultes,
    form.nbrs_enfants,
    form.nbrs_bebe,
    enfantAges,
    form.promotion_id,
    nbNuits,
    chambres,
    selectedPromotion,
  ]);

  const selectedMaison = useMemo(
    () => maisons.find((item) => String(item.id) === form.maison_id) || null,
    [maisons, form.maison_id]
  );

  const computedTotals = useMemo(() => {
    const nbAssujettisTaxe = countTaxeSejourAssujettis({
      nb_adultes: nbAdultes,
      occupants: occupants.map((item) => ({
        type_occupant: item.type_occupant,
        age_enfant: item.age_enfant !== "" ? Number(item.age_enfant) : null,
      })),
    });

    return calculateReservationTotals({
      prix_chambre_total: Number(form.prix_chambre_total) || 0,
      prix_bebe_total: Number(form.prix_bebe_total) || 0,
      prix_enfants_total: Number(form.prix_enfants_total) || 0,
      supplement_total: supplementTotal,
      type_reduction: form.type_reduction || null,
      valeur_reduction: Number(form.valeur_reduction) || 0,
      taux_tva_applique: Number(form.taux_tva_applique) || 0,
      taxe_de_sejour: Number(selectedMaison?.taxe_de_sejour) || 0,
      nb_nuits: nbNuits,
      nb_assujettis_taxe: nbAssujettisTaxe,
    });
  }, [
    form,
    supplementTotal,
    selectedMaison?.taxe_de_sejour,
    nbNuits,
    nbAdultes,
    occupants,
  ]);

  const filteredReservations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reservations.filter((reservation) => {
      if (filterMaison !== "all" && String(reservation.maison_id) !== filterMaison) {
        return false;
      }

      if (filterStatut !== "all" && reservation.statut_reservation !== filterStatut) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        reservation.reference,
        reservation.client_nom,
        reservation.maison_nom,
        reservation.chambre_nom,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [reservations, search, filterMaison, filterStatut]);

  const openCreate = () => {
    setEditingReservation(null);
    setForm(emptyForm(maisons[0] ? String(maisons[0].id) : ""));
    setOccupants(buildOccupantsFromCounts(1, 0, 0));
    setFormStep("details");
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = async (reservation: Reservation) => {
    setEditingReservation(reservation);
    setForm(toFormState(reservation));
    setFormStep("details");
    setFormError("");
    setDialogOpen(true);

    try {
      const detailed = await fetchReservation(reservation.id);
      setEditingReservation(detailed);
      setForm(toFormState(detailed));
      setOccupants(occupantsFromReservation(detailed, tranchesAge));
    } catch {
      setOccupants(occupantsFromReservation(reservation, tranchesAge));
    }
  };

  const buildMaisonFallback = (maisonId: number): MaisonDetail | null => {
    const fallback = maisons.find((item) => item.id === maisonId);

    if (!fallback) {
      return null;
    }

    return {
      ...fallback,
      latitude: null,
      longitude: null,
      photos: fallback.photo_principale
        ? [{ url: fallback.photo_principale, est_principale: true, ordre: 0 }]
        : [],
      services: [],
      equipements: [],
      langues: [],
      horaires: [],
      service_ids: [],
      equipement_ids: [],
      langue_ids: [],
    };
  };

  const loadMaisonForReservation = async (maisonId: number) => {
    try {
      return await fetchMaison(maisonId);
    } catch {
      return buildMaisonFallback(maisonId);
    }
  };

  const openViewSheet = async (reservation: Reservation) => {
    setViewReservation(reservation);
    setViewSheetOpen(true);
    setLoadingViewSheet(true);
    setViewMaison(null);
    setShowConfirmFloatingBtn(false);

    try {
      const [detailed, maison] = await Promise.all([
        fetchReservation(reservation.id),
        loadMaisonForReservation(reservation.maison_id),
      ]);
      setViewReservation(detailed);
      setViewMaison(maison);
    } catch {
      const maison = await loadMaisonForReservation(reservation.maison_id).catch(() => null);
      setViewMaison(maison);
    } finally {
      setLoadingViewSheet(false);
    }
  };

  useEffect(() => {
    if (!viewSheetOpen) {
      setShowConfirmFloatingBtn(false);
      return;
    }

    const node = viewSheetScrollRef.current;

    if (!node) {
      return;
    }

    const handleScroll = () => {
      setShowConfirmFloatingBtn(node.scrollTop > 120);
    };

    handleScroll();
    node.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      node.removeEventListener("scroll", handleScroll);
    };
  }, [viewSheetOpen, loadingViewSheet, viewReservation?.id]);

  const confirmReservation = async () => {
    if (!confirmTarget) {
      return;
    }

    setConfirmingReservation(true);
    setErrorMessage("");

    try {
      const detailed = await fetchReservation(confirmTarget.id);
      const updated = await updateReservation(confirmTarget.id, {
        client_id: detailed.client_id,
        maison_id: detailed.maison_id,
        chambre_id: detailed.chambre_id,
        date_arrivee: toDateOnlyLocal(detailed.date_arrivee),
        date_depart: toDateOnlyLocal(detailed.date_depart),
        nb_adultes: detailed.nb_adultes,
        nbrs_enfants: detailed.nbrs_enfants,
        nbrs_bebe: detailed.nbrs_bebe,
        lit_bebe: Number(detailed.lit_bebe) === 1 || detailed.lit_bebe === true ? 1 : 0,
        age_enfant: detailed.age_enfant,
        source: detailed.source,
        promotion_id: detailed.promotion_id,
        type_reduction: detailed.type_reduction,
        valeur_reduction: Number(detailed.valeur_reduction) || 0,
        supplement_id: detailed.supplement_id,
        prix_chambre_total: Number(detailed.prix_chambre_total) || 0,
        prix_bebe_total: Number(detailed.prix_bebe_total) || 0,
        prix_enfants_total: Number(detailed.prix_enfants_total) || 0,
        taux_tva_applique: Number(detailed.taux_tva_applique) || 0,
        prix_total_ht: Number(detailed.prix_total_ht) || 0,
        montant_tva: Number(detailed.montant_tva) || 0,
        prix_total_ttc: Number(detailed.prix_total_ttc) || 0,
        statut_reservation: "confirmee",
        statut_paiement: detailed.statut_paiement,
        montant_paye: Number(detailed.montant_paye) || 0,
        notes: detailed.notes,
        occupants: (detailed.occupants || []).map((occupant) => ({
          type_occupant: occupant.type_occupant,
          nom: occupant.nom,
          prenom: occupant.prenom,
          age_enfant: occupant.age_enfant,
          tranche_age_id: occupant.tranche_age_id,
          supplement_id: occupant.supplement_id ?? null,
          date_naissance: occupant.date_naissance ?? null,
          piece_identite: occupant.piece_identite ?? null,
          allergies_regime: occupant.allergies_regime ?? null,
          prix_unitaire: Number(occupant.prix_unitaire) || 0,
          prix_total: Number(occupant.prix_total) || 0,
        })),
      });

      setViewReservation(updated);
      setConfirmTarget(null);
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de confirmer la réservation."
      );
      setConfirmTarget(null);
    } finally {
      setConfirmingReservation(false);
    }
  };

  const handleDownloadPdf = async (reservation: Reservation) => {
    setDownloadingPdfId(reservation.id);
    setErrorMessage("");

    try {
      const [detailed, maison] = await Promise.all([
        fetchReservation(reservation.id),
        loadMaisonForReservation(reservation.maison_id),
      ]);
      await downloadReservationSheetPdf(detailed, maison);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de télécharger la fiche PDF."
      );
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleChambreChange = (chambreId: string) => {
    const pricing = applyChambrePricing(
      chambreId,
      nbNuits,
      chambres,
      {
        nb_adultes: nbAdultes,
        nbrs_enfants: nbrsEnfants,
        nbrs_bebe: nbrsBebe,
        enfant_ages: enfantAges,
      },
      selectedPromotion
    );

    setForm((current) => ({
      ...current,
      chambre_id: chambreId,
      prix_chambre_total:
        pricing.prix_chambre_total != null
          ? String(pricing.prix_chambre_total)
          : current.prix_chambre_total,
      prix_bebe_total:
        pricing.prix_bebe_total != null
          ? String(pricing.prix_bebe_total)
          : current.prix_bebe_total,
      prix_enfants_total:
        pricing.prix_enfants_total != null
          ? String(pricing.prix_enfants_total)
          : current.prix_enfants_total,
    }));
  };

  const updateOccupant = (key: string, patch: Partial<OccupantFormState>) => {
    setOccupants((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  };

  const validateDetailsStep = () => {
    if (!form.client_id || !form.maison_id || !form.chambre_id) {
      setFormError("Client, maison et chambre sont requis.");
      return false;
    }

    if (!form.date_arrivee || !form.date_depart) {
      setFormError("Les dates d'arrivée et de départ sont requises.");
      return false;
    }

    if (nbNuits <= 0) {
      setFormError("La date de départ doit être après la date d'arrivée.");
      return false;
    }

    return true;
  };

  const goToOccupantsStep = () => {
    setFormError("");

    if (!validateDetailsStep()) {
      return;
    }

    const selectedClient = clients.find((client) => String(client.id) === form.client_id);
    const clientNom = selectedClient?.nom?.trim() || "";
    const clientPrenom = selectedClient?.prenom?.trim() || "";

    setOccupants((current) => {
      const next = buildOccupantsFromCounts(nbAdultes, nbrsEnfants, nbrsBebe, current);

      return next.map((occupant, index) => {
        if (occupant.type_occupant !== "adulte") {
          return occupant;
        }

        const adultIndex = next
          .slice(0, index + 1)
          .filter((item) => item.type_occupant === "adulte").length;

        // Adulte 1 = client principal
        if (adultIndex === 1) {
          return {
            ...occupant,
            nom: occupant.nom.trim() || clientNom,
            prenom: occupant.prenom.trim() || clientPrenom,
          };
        }

        return occupant;
      });
    });
    setFormStep("occupants");
  };

  const buildOccupantsPayload = (): ReservationOccupantFormData[] | null => {
    const synced = buildOccupantsFromCounts(nbAdultes, nbrsEnfants, nbrsBebe, occupants);

    for (const occupant of synced) {
      if (!occupant.nom.trim() || !occupant.prenom.trim()) {
        setFormError("Chaque occupant doit avoir un nom et un prénom.");
        return null;
      }

      if (occupant.type_occupant === "enfant") {
        if (!occupant.age_enfant) {
          setFormError("Sélectionnez l'âge de chaque enfant.");
          return null;
        }

        const age = Number(occupant.age_enfant);
        const trancheId =
          Number(occupant.tranche_age_id) || resolveTrancheAgeId(tranchesAge, age);

        if (!trancheId) {
          setFormError(`Aucune tranche d'âge trouvée pour ${age} an(s).`);
          return null;
        }
      }
    }

    return synced.map((occupant) => {
      const age =
        occupant.type_occupant === "enfant" ? Number(occupant.age_enfant) : null;
      const trancheId =
        occupant.type_occupant === "enfant"
          ? Number(occupant.tranche_age_id) ||
            resolveTrancheAgeId(tranchesAge, age ?? -1)
          : null;

      let prixUnitaire = 0;

      if (selectedChambre && occupant.type_occupant === "adulte") {
        prixUnitaire =
          calculateChambreStayTotal(
            selectedChambre.prix_adulte,
            Math.max(nbNuits, 1),
            selectedPromotion
          ) ?? 0;
      } else if (selectedChambre && occupant.type_occupant === "enfant" && age != null) {
        prixUnitaire =
          calculateEnfantStayTotal(
            selectedChambre,
            Math.max(nbNuits, 1),
            age,
            selectedPromotion
          ) ?? 0;
      } else if (selectedChambre && occupant.type_occupant === "bebe") {
        prixUnitaire =
          calculateBebeStayTotal(
            selectedChambre,
            Math.max(nbNuits, 1),
            selectedPromotion
          ) ?? 0;
      }

      const supplementAmount = getOccupantSupplementAmount(occupant);
      const prixTotal = Math.round((prixUnitaire + supplementAmount) * 100) / 100;

      return {
        type_occupant: occupant.type_occupant,
        nom: occupant.nom.trim(),
        prenom: occupant.prenom.trim(),
        age_enfant: age,
        tranche_age_id: trancheId,
        supplement_id: occupant.supplement_id ? Number(occupant.supplement_id) : null,
        date_naissance: occupant.date_naissance || null,
        piece_identite:
          occupant.type_occupant === "adulte"
            ? occupant.piece_identite.trim() || null
            : null,
        prix_unitaire: prixUnitaire,
        prix_total: prixTotal,
      };
    });
  };

  const buildPayload = (): ReservationFormData | null => {
    if (!validateDetailsStep()) {
      return null;
    }

    const occupantsPayload = buildOccupantsPayload();

    if (!occupantsPayload) {
      return null;
    }

    const firstChildAge =
      occupantsPayload.find((item) => item.type_occupant === "enfant")?.age_enfant ?? 0;

    return {
      client_id: Number(form.client_id),
      maison_id: Number(form.maison_id),
      chambre_id: Number(form.chambre_id),
      date_arrivee: form.date_arrivee,
      date_depart: form.date_depart,
      nb_adultes: nbAdultes,
      nbrs_enfants: nbrsEnfants,
      nbrs_bebe: nbrsBebe,
      lit_bebe: form.lit_bebe ? 1 : 0,
      age_enfant: firstChildAge || 0,
      source: form.source,
      promotion_id: form.promotion_id ? Number(form.promotion_id) : null,
      code_promo:
        promotions.find((item) => String(item.id) === form.promotion_id)?.code_promo || null,
      type_reduction: form.type_reduction || null,
      valeur_reduction: Number(form.valeur_reduction) || 0,
      supplement_id: null,
      prix_chambre_total: Number(form.prix_chambre_total) || 0,
      prix_bebe_total: Number(form.prix_bebe_total) || 0,
      prix_enfants_total: Number(form.prix_enfants_total) || 0,
      taux_tva_applique: Number(form.taux_tva_applique) || 0,
      prix_total_ht: computedTotals.prix_total_ht,
      montant_tva: computedTotals.montant_tva,
      prix_total_ttc: computedTotals.prix_total_ttc,
      taxe_sejour_montant: computedTotals.taxe_sejour_montant,
      statut_reservation: form.statut_reservation,
      statut_paiement: form.statut_paiement,
      montant_paye: Number(form.montant_paye) || 0,
      notes: form.notes.trim() || null,
      occupants: occupantsPayload,
    };
  };

  const saveReservation = async () => {
    const payload = buildPayload();

    if (!payload) {
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      if (editingReservation) {
        await updateReservation(editingReservation.id, payload);
        setDialogOpen(false);
        setFormStep("details");
        await loadData();
      } else {
        const created = await createReservation(payload);
        setDialogOpen(false);
        setFormStep("details");
        await loadData();
        await openViewSheet(created);
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Impossible d'enregistrer la réservation."
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
      await deleteReservation(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de supprimer la réservation."
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des réservations…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[22px]">
            Réservations
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Créez et suivez les réservations des clients.
          </p>
        </div>

        <Button onClick={openCreate} className="rounded-full">
          <Plus className="h-4 w-4" />
          Nouvelle réservation
        </Button>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par référence, client, maison…"
            className="pl-9"
          />
        </div>

        <Select value={filterMaison} onValueChange={setFilterMaison}>
          <SelectTrigger className="w-full lg:w-[220px]">
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

        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-full lg:w-[200px]">
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
      </div>

      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Maison</TableHead>
              <TableHead>Chambre</TableHead>
              <TableHead>Arrivée</TableHead>
              <TableHead>Départ</TableHead>
              <TableHead>Nuits</TableHead>
              <TableHead>Total TTC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-slate-500">
                  Aucune réservation trouvée.
                </TableCell>
              </TableRow>
            ) : (
              filteredReservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell className="font-mono text-[12px] font-medium">
                    {reservation.reference}
                  </TableCell>
                  <TableCell>{reservation.client_nom || "—"}</TableCell>
                  <TableCell>{reservation.maison_nom || "—"}</TableCell>
                  <TableCell>{reservation.chambre_nom || "—"}</TableCell>
                  <TableCell>{dateInput(reservation.date_arrivee)}</TableCell>
                  <TableCell>{dateInput(reservation.date_depart)}</TableCell>
                  <TableCell>{reservation.nb_nuits}</TableCell>
                  <TableCell>{formatMoney(reservation.prix_total_ttc)}</TableCell>
                  <TableCell>
                    <Badge variant={statutBadgeVariant(reservation.statut_reservation)}>
                      {STATUT_LABELS[reservation.statut_reservation]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {PAIEMENT_LABELS[reservation.statut_paiement]}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void openViewSheet(reservation)}>
                          <Eye className="h-4 w-4" />
                          Voir fiche réservation
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={downloadingPdfId === reservation.id}
                          onClick={() => void handleDownloadPdf(reservation)}
                        >
                          <Download className="h-4 w-4" />
                          {downloadingPdfId === reservation.id
                            ? "Génération PDF..."
                            : "Télécharger fiche PDF"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void openEdit(reservation)}>
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteTarget(reservation)}
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setFormStep("details");
            setFormError("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingReservation
                ? `Modifier ${editingReservation.reference}`
                : "Nouvelle réservation"}
            </DialogTitle>
            <p className="text-[13px] text-slate-500">
              {formStep === "details"
                ? "Étape 1/2 — Détails du séjour"
                : "Étape 2/2 — Occupants et tarification"}
            </p>
          </DialogHeader>

          {formStep === "details" ? (
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Séjour</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Client *</Label>
                  <Select
                    value={form.client_id || undefined}
                    onValueChange={(value) => setForm((c) => ({ ...c, client_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {[client.prenom, client.nom].filter(Boolean).join(" ") || client.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Maison d&apos;hôtes *</Label>
                  <Select
                    value={form.maison_id || undefined}
                    onValueChange={(value) => {
                      setForm((c) => ({
                        ...c,
                        maison_id: value,
                        chambre_id: "",
                        supplement_id: "",
                        prix_chambre_total: "0",
                        prix_bebe_total: "0",
                        prix_enfants_total: "0",
                      }));
                      setOccupants((current) =>
                        current.map((occupant) => ({ ...occupant, supplement_id: "" }))
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Maison" />
                    </SelectTrigger>
                    <SelectContent>
                      {maisons.map((maison) => (
                        <SelectItem key={maison.id} value={String(maison.id)}>
                          {maison.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Chambre *</Label>
                  <Select
                    value={form.chambre_id || undefined}
                    onValueChange={handleChambreChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chambre" />
                    </SelectTrigger>
                    <SelectContent>
                      {chambres.map((chambre) => {
                        const nightly = calculateChambreStayTotal(
                          chambre.prix_adulte,
                          1,
                          selectedPromotion
                        );

                        const typeLabel = chambre.type_nom?.trim();
                        const nameWithType = typeLabel
                          ? `${chambre.nom} · ${typeLabel}`
                          : chambre.nom;

                        return (
                          <SelectItem key={chambre.id} value={String(chambre.id)}>
                            {nightly != null
                              ? `${nameWithType} · ${nightly.toLocaleString("fr-FR")} MAD/nuit`
                              : nameWithType}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {form.chambre_id ? (
                    <p className="text-[11px] text-slate-500">
                      {saisons.length > 0
                        ? `Tarif saison : ${saisons.find((s) => s.id === findSaisonForDate(saisons, form.date_arrivee))?.nom ?? "—"}`
                        : "Aucune saison configurée pour cette maison."}
                      {nbNuits > 0 ? ` · ${nbNuits} nuit${nbNuits > 1 ? "s" : ""}` : ""}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Date d&apos;arrivée *</Label>
                  <Input
                    type="date"
                    value={form.date_arrivee}
                    onChange={(e) => setForm((c) => ({ ...c, date_arrivee: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date de départ *</Label>
                  <Input
                    type="date"
                    value={form.date_depart}
                    onChange={(e) => setForm((c) => ({ ...c, date_depart: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nombre de nuits</Label>
                  <Input value={nbNuits || "—"} disabled />
                </div>

                <div className="space-y-2">
                  <Label>Adultes</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.nb_adultes}
                    onChange={(e) => setForm((c) => ({ ...c, nb_adultes: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Enfants</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.nbrs_enfants}
                    onChange={(e) => {
                      const value = e.target.value;

                      setForm((current) => ({
                        ...current,
                        nbrs_enfants: value,
                        prix_enfants_total: Number(value) > 0 ? current.prix_enfants_total : "0",
                      }));
                    }}
                  />
                  <p className="text-[11px] text-slate-500">
                    Les noms et âges seront saisis à l&apos;étape suivante.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Bébés</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.nbrs_bebe}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        nbrs_bebe: e.target.value,
                        prix_bebe_total: Number(e.target.value) > 0 ? c.prix_bebe_total : "0",
                        lit_bebe: Number(e.target.value) > 0 ? c.lit_bebe : false,
                      }))
                    }
                  />
                  {nbrsBebe > 0 ? (
                    <label className="flex items-center gap-2 pt-1 text-sm">
                      <Checkbox
                        checked={form.lit_bebe}
                        onCheckedChange={(checked) =>
                          setForm((c) => ({ ...c, lit_bebe: checked === true }))
                        }
                      />
                      Lit bébé demandé
                    </label>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select
                    value={form.source}
                    onValueChange={(value) =>
                      setForm((c) => ({ ...c, source: value as ReservationSource }))
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
                  <Label>Promotion</Label>
                  <Select
                    value={form.promotion_id || "none"}
                    onValueChange={(value) =>
                      setForm((c) => ({ ...c, promotion_id: value === "none" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {promotions.map((promotion) => (
                        <SelectItem key={promotion.id} value={String(promotion.id)}>
                          {promotion.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Statut réservation</Label>
                <Select
                  value={form.statut_reservation}
                  onValueChange={(value) =>
                    setForm((c) => ({ ...c, statut_reservation: value as ReservationStatut }))
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
                <Label>Statut paiement</Label>
                <Select
                  value={form.statut_paiement}
                  onValueChange={(value) =>
                    setForm((c) => ({
                      ...c,
                      statut_paiement: value as ReservationStatutPaiement,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAIEMENT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </section>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          ) : (
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Adultes ({nbAdultes})</h3>
              <div className="space-y-3">
                {occupants
                  .filter((item) => item.type_occupant === "adulte")
                  .map((occupant, index) => {
                    const basePrice = selectedChambre
                      ? calculateChambreStayTotal(
                          selectedChambre.prix_adulte,
                          Math.max(nbNuits, 1),
                          selectedPromotion
                        )
                      : Number(form.prix_chambre_total) / Math.max(nbAdultes, 1);
                    const supplementAmount = getOccupantSupplementAmount(occupant);

                    return (
                    <div
                      key={occupant.key}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2"
                    >
                        <p className="sm:col-span-2 flex items-center justify-between text-[12px] font-semibold text-slate-500">
                          <span>Adulte {index + 1}</span>
                          <span className="font-medium text-slate-700">
                            {formatMoney((Number(basePrice) || 0) + supplementAmount)}
                          </span>
                        </p>
                      <div className="space-y-2">
                        <Label>Prénom *</Label>
                        <Input
                          value={occupant.prenom}
                          onChange={(e) =>
                            updateOccupant(occupant.key, { prenom: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nom *</Label>
                        <Input
                          value={occupant.nom}
                          onChange={(e) =>
                            updateOccupant(occupant.key, { nom: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Date de naissance</Label>
                        <Input
                          type="date"
                          value={occupant.date_naissance}
                          onChange={(e) =>
                            updateOccupant(occupant.key, {
                              date_naissance: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pièce d&apos;identité</Label>
                        <Input
                          value={occupant.piece_identite}
                          onChange={(e) =>
                            updateOccupant(occupant.key, {
                              piece_identite: e.target.value,
                            })
                          }
                          placeholder="CIN, passeport…"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Supplément</Label>
                        <Select
                          value={occupant.supplement_id || "none"}
                          onValueChange={(value) =>
                            updateOccupant(occupant.key, {
                              supplement_id: value === "none" ? "" : value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Aucun" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            {supplements.map((supplement) => (
                              <SelectItem key={supplement.id} value={String(supplement.id)}>
                                {supplement.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {occupant.supplement_id ? (
                          <p className="text-[11px] text-slate-500">
                            {supplementAmount > 0
                              ? `Supplément : ${supplementAmount.toLocaleString("fr-FR")} MAD (${nbNuits || 1} nuit${(nbNuits || 1) > 1 ? "s" : ""})`
                              : "Aucun tarif configuré pour ce supplément et cette saison."}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    );
                  })}
              </div>
            </section>

            {nbrsEnfants > 0 ? (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Enfants ({nbrsEnfants})</h3>
                <div className="space-y-3">
                  {occupants
                    .filter((item) => item.type_occupant === "enfant")
                    .map((occupant, index) => {
                      const basePrice =
                        occupant.age_enfant && selectedChambre
                          ? calculateEnfantStayTotal(
                              selectedChambre,
                              Math.max(nbNuits, 1),
                              Number(occupant.age_enfant),
                              selectedPromotion
                            )
                          : null;
                      const supplementAmount = getOccupantSupplementAmount(occupant);

                      return (
                      <div
                        key={occupant.key}
                        className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2"
                      >
                        <p className="sm:col-span-2 flex items-center justify-between text-[12px] font-semibold text-slate-500">
                          <span>Enfant {index + 1}</span>
                          <span className="font-medium text-slate-700">
                            {basePrice != null
                              ? formatMoney(basePrice + supplementAmount)
                              : "—"}
                          </span>
                        </p>
                        <div className="space-y-2">
                          <Label>Prénom *</Label>
                          <Input
                            value={occupant.prenom}
                            onChange={(e) =>
                              updateOccupant(occupant.key, { prenom: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nom *</Label>
                          <Input
                            value={occupant.nom}
                            onChange={(e) =>
                              updateOccupant(occupant.key, { nom: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Date de naissance</Label>
                          <Input
                            type="date"
                            value={occupant.date_naissance}
                            onChange={(e) =>
                              updateOccupant(occupant.key, {
                                date_naissance: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Supplément</Label>
                          <Select
                            value={occupant.supplement_id || "none"}
                            onValueChange={(value) =>
                              updateOccupant(occupant.key, {
                                supplement_id: value === "none" ? "" : value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Aucun" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Aucun</SelectItem>
                              {supplements.map((supplement) => (
                                <SelectItem key={supplement.id} value={String(supplement.id)}>
                                  {supplement.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {occupant.supplement_id ? (
                            <p className="text-[11px] text-slate-500">
                              {supplementAmount > 0
                                ? `Supplément : ${supplementAmount.toLocaleString("fr-FR")} MAD (${nbNuits || 1} nuit${(nbNuits || 1) > 1 ? "s" : ""})`
                                : "Aucun tarif configuré pour ce supplément et cette saison."}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Âge de l&apos;enfant *</Label>
                          <Select
                            value={occupant.age_enfant || undefined}
                            onValueChange={(value) => {
                              const age = Number(value);
                              const trancheId = resolveTrancheAgeId(tranchesAge, age);
                              updateOccupant(occupant.key, {
                                age_enfant: value,
                                tranche_age_id: trancheId ? String(trancheId) : "",
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner l'âge" />
                            </SelectTrigger>
                            <SelectContent>
                              {enfantAgeOptions.length > 0 ? (
                                enfantAgeOptions.map((option) => (
                                  <SelectItem key={option.age} value={String(option.age)}>
                                    {option.label}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>
                                  Aucune tranche enfant pour cette chambre
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {occupant.age_enfant ? (
                            <p className="text-[11px] text-slate-500">
                              {(() => {
                                const age = Number(occupant.age_enfant);
                                const tranche = tranchesAge.find(
                                  (item) =>
                                    Number(occupant.tranche_age_id) === item.id ||
                                    (age >= item.age_min && age <= item.age_max)
                                );
                                return tranche
                                  ? `Tranche : ${tranche.nom} (${tranche.age_min}-${tranche.age_max} ans)`
                                  : "Tranche d'âge non trouvée pour cet âge.";
                              })()}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      );
                    })}
                </div>
              </section>
            ) : null}

            {nbrsBebe > 0 ? (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Bébés ({nbrsBebe})</h3>
                <div className="space-y-3">
                  {occupants
                    .filter((item) => item.type_occupant === "bebe")
                    .map((occupant, index) => {
                      const basePrice = selectedChambre
                        ? calculateBebeStayTotal(
                            selectedChambre,
                            Math.max(nbNuits, 1),
                            selectedPromotion
                          )
                        : Number(form.prix_bebe_total) / Math.max(nbrsBebe, 1);
                      const supplementAmount = getOccupantSupplementAmount(occupant);

                      return (
                      <div
                        key={occupant.key}
                        className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2"
                      >
                        <p className="sm:col-span-2 flex items-center justify-between text-[12px] font-semibold text-slate-500">
                          <span>Bébé {index + 1}</span>
                          <span className="font-medium text-slate-700">
                            {formatMoney((Number(basePrice) || 0) + supplementAmount)}
                          </span>
                        </p>
                        <div className="space-y-2">
                          <Label>Prénom *</Label>
                          <Input
                            value={occupant.prenom}
                            onChange={(e) =>
                              updateOccupant(occupant.key, { prenom: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nom *</Label>
                          <Input
                            value={occupant.nom}
                            onChange={(e) =>
                              updateOccupant(occupant.key, { nom: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Date de naissance</Label>
                          <Input
                            type="date"
                            value={occupant.date_naissance}
                            onChange={(e) =>
                              updateOccupant(occupant.key, {
                                date_naissance: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Supplément</Label>
                          <Select
                            value={occupant.supplement_id || "none"}
                            onValueChange={(value) =>
                              updateOccupant(occupant.key, {
                                supplement_id: value === "none" ? "" : value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Aucun" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Aucun</SelectItem>
                              {supplements.map((supplement) => (
                                <SelectItem key={supplement.id} value={String(supplement.id)}>
                                  {supplement.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {occupant.supplement_id ? (
                            <p className="text-[11px] text-slate-500">
                              {supplementAmount > 0
                                ? `Supplément : ${supplementAmount.toLocaleString("fr-FR")} MAD (${nbNuits || 1} nuit${(nbNuits || 1) > 1 ? "s" : ""})`
                                : "Aucun tarif configuré pour ce supplément et cette saison."}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      );
                    })}
                </div>
              </section>
            ) : null}

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Tarification</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prix chambre</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.prix_chambre_total}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, prix_chambre_total: e.target.value }))
                    }
                  />
                  {form.chambre_id ? (
                    <p className="text-[11px] text-slate-500">
                      {(() => {
                        const chambre = chambres.find(
                          (item) => String(item.id) === form.chambre_id
                        );
                        const nightly = chambre
                          ? calculateChambreStayTotal(
                              chambre.prix_adulte,
                              1,
                              selectedPromotion
                            )
                          : null;

                        return nightly != null && nightly > 0
                          ? `Tarif adulte : ${nightly.toLocaleString("fr-FR")} MAD/nuit × ${nbAdultes}${selectedPromotion ? " (promo)" : ""}`
                          : "Aucun tarif adulte configuré pour cette chambre.";
                      })()}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Prix bébé</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.prix_bebe_total}
                    disabled={nbrsBebe <= 0}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, prix_bebe_total: e.target.value }))
                    }
                  />
                  {form.chambre_id ? (
                    <p className="text-[11px] text-slate-500">
                      {(() => {
                        if (nbrsBebe <= 0) {
                          return "Indiquez un nombre de bébés pour calculer ce tarif.";
                        }

                        const chambre = chambres.find(
                          (item) => String(item.id) === form.chambre_id
                        );
                        const nightly = chambre
                          ? calculateBebeStayTotal(chambre, 1, selectedPromotion)
                          : null;

                        return nightly != null && nightly > 0
                          ? `Tarif bébé : ${nightly.toLocaleString("fr-FR")} MAD/nuit × ${nbrsBebe}${selectedPromotion ? " (promo)" : ""}`
                          : "Aucun tarif bébé configuré pour cette chambre.";
                      })()}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Prix enfants</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.prix_enfants_total}
                    disabled={nbrsEnfants <= 0}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, prix_enfants_total: e.target.value }))
                    }
                  />
                  {form.chambre_id ? (
                    <p className="text-[11px] text-slate-500">
                      {(() => {
                        if (nbrsEnfants <= 0) {
                          return "Indiquez un nombre d'enfants pour calculer ce tarif.";
                        }

                        if (enfantAges.length === 0 || !selectedChambre) {
                          return "Saisissez les âges des enfants ci-dessus pour calculer ce tarif.";
                        }

                        const bebeTranche = getBebeTranche(selectedChambre);
                        const autresEnfants = (selectedChambre.tarifs_enfant || []).filter(
                          (tarif) => tarif !== bebeTranche
                        );
                        const labels = enfantAges.map((age) => {
                          const tranche = findTrancheTarifForAge(autresEnfants, age);
                          return tranche
                            ? `${age} an${age > 1 ? "s" : ""} · ${tranche.tranche_nom}`
                            : `${age} an${age > 1 ? "s" : ""}`;
                        });

                        return `Âges saisis : ${labels.join(", ")}${selectedPromotion ? " (promo)" : ""}`;
                      })()}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Type de réduction</Label>
                  <Select
                    value={form.type_reduction || "none"}
                    onValueChange={(value) =>
                      setForm((c) => ({
                        ...c,
                        type_reduction: value === "none" ? "" : (value as ReservationTypeReduction),
                        valeur_reduction: value === "none" ? "0" : c.valeur_reduction,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      <SelectItem value="%">Pourcentage (%)</SelectItem>
                      <SelectItem value="MAD">Montant (MAD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Valeur réduction
                    {form.type_reduction === "%"
                      ? " (%)"
                      : form.type_reduction === "MAD"
                        ? " (MAD)"
                        : ""}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!form.type_reduction}
                    value={form.valeur_reduction}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, valeur_reduction: e.target.value }))
                    }
                  />
                  {form.type_reduction && Number(form.valeur_reduction) > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Réduction calculée : {formatMoney(computedTotals.montant_reduction)}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>TVA (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.taux_tva_applique}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, taux_tva_applique: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montant payé</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.montant_paye}
                    onChange={(e) => setForm((c) => ({ ...c, montant_paye: e.target.value }))}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">
                {supplementTotal > 0 ? (
                  <p>Supplément : {formatMoney(supplementTotal)}</p>
                ) : null}
                <p>Total HT : {formatMoney(computedTotals.prix_total_ht)}</p>
                <p>TVA : {formatMoney(computedTotals.montant_tva)}</p>
                <p className="font-semibold text-slate-900">
                  Total TTC : {formatMoney(computedTotals.prix_total_ttc)}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Récapitulatif tarifaire</h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span>Nombre de nuits</span>
                  <span>{nbNuits || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Adultes ({nbAdultes})</span>
                  <span>{formatMoney(form.prix_chambre_total)}</span>
                </div>
                {nbrsEnfants > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>Enfants ({nbrsEnfants})</span>
                    <span>{formatMoney(form.prix_enfants_total)}</span>
                  </div>
                ) : null}
                {nbrsBebe > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>Bébés ({nbrsBebe})</span>
                    <span>{formatMoney(form.prix_bebe_total)}</span>
                  </div>
                ) : null}
                {supplementTotal > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>Supplément</span>
                    <span>{formatMoney(supplementTotal)}</span>
                  </div>
                ) : null}
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <span>Total HT</span>
                    <span>{formatMoney(computedTotals.prix_total_ht)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>TVA ({form.taux_tva_applique}%)</span>
                    <span>{formatMoney(computedTotals.montant_tva)}</span>
                  </div>
                  {computedTotals.montant_reduction > 0 ? (
                    <div className="flex items-center justify-between gap-3 text-emerald-700">
                      <span>
                        Réduction
                        {form.type_reduction === "%"
                          ? ` (${form.valeur_reduction}%)`
                          : form.type_reduction === "MAD"
                            ? ` (${form.valeur_reduction} MAD)`
                            : ""}
                      </span>
                      <span>- {formatMoney(computedTotals.montant_reduction)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <span>Total TTC</span>
                    <span>{formatMoney(computedTotals.prix_total_ttc)}</span>
                  </div>
                  {computedTotals.taxe_sejour_montant > 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <span>Taxe de séjour</span>
                      <span>{formatMoney(computedTotals.taxe_sejour_montant)}</span>
                    </div>
                  ) : null}
                  <div className="mt-1 flex items-center justify-between gap-3 text-[15px] font-semibold text-slate-900">
                    <span>Total à payer</span>
                    <span>{formatMoney(computedTotals.total_a_payer)}</span>
                  </div>
                </div>
              </div>
            </section>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          )}

          <DialogFooter>
            {formStep === "details" ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={goToOccupantsStep}>Suivant</Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormError("");
                    setFormStep("details");
                  }}
                >
                  Retour
                </Button>
                <Button onClick={() => void saveReservation()} disabled={saving}>
                  {saving
                    ? "Enregistrement…"
                    : editingReservation
                      ? "Mettre à jour"
                      : "Créer"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewSheetOpen}
        onOpenChange={(open) => {
          setViewSheetOpen(open);

          if (!open) {
            setViewReservation(null);
            setViewMaison(null);
            setShowConfirmFloatingBtn(false);
            setConfirmTarget(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-3xl">
          {loadingViewSheet ? (
            <div className="p-8 text-center text-[13px] text-slate-500">
              Chargement de la fiche...
            </div>
          ) : viewReservation ? (
            <div className="relative max-h-[92vh]">
            <div ref={viewSheetScrollRef} className="max-h-[92vh] overflow-y-auto">
              <div className="relative h-52 w-full overflow-hidden bg-slate-900 sm:h-60">
                {viewMaison && getMaisonHeroPhoto(viewMaison) ? (
                  <img
                    src={resolvePhotoUrl(getMaisonHeroPhoto(viewMaison))}
                    alt={viewMaison.nom}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-sm text-slate-300">
                    Aucune photo disponible
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                    Maison d&apos;hôtes
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    {viewMaison?.nom || viewReservation.maison_nom || "—"}
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-200">
                    {[viewMaison?.ville, viewMaison?.quartier].filter(Boolean).join(" · ") ||
                      "Maroc"}
                  </p>
                </div>
              </div>

              <div className="space-y-6 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Réservation
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
                      {viewReservation.reference}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statutBadgeVariant(viewReservation.statut_reservation)}>
                      {STATUT_LABELS[viewReservation.statut_reservation]}
                    </Badge>
                    <Badge variant="outline">
                      {PAIEMENT_LABELS[viewReservation.statut_paiement]}
                    </Badge>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Séjour</h3>
                  <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                    <FicheInfoItem label="Client" value={viewReservation.client_nom} />
                    <FicheInfoItem label="Email" value={viewReservation.client_email} />
                    <FicheInfoItem label="Chambre" value={viewReservation.chambre_nom} />
                    <FicheInfoItem label="Source" value={SOURCE_LABELS[viewReservation.source]} />
                    <FicheInfoItem
                      label="Arrivée"
                      value={formatDateDisplay(viewReservation.date_arrivee)}
                    />
                    <FicheInfoItem
                      label="Départ"
                      value={formatDateDisplay(viewReservation.date_depart)}
                    />
                    <FicheInfoItem label="Nuits" value={viewReservation.nb_nuits} />
                    <FicheInfoItem
                      label="Créée le"
                      value={formatDateDisplay(viewReservation.date_creation)}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Voyageurs</h3>
                  <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FicheInfoItem label="Adultes" value={viewReservation.nb_adultes} />
                    <FicheInfoItem label="Enfants" value={viewReservation.nbrs_enfants} />
                    <FicheInfoItem label="Bébés" value={viewReservation.nbrs_bebe} />
                    <FicheInfoItem
                      label="Lit bébé"
                      value={
                        Number(viewReservation.lit_bebe) === 1 ||
                        viewReservation.lit_bebe === true
                          ? "Demandé"
                          : "Non"
                      }
                    />
                  </div>
                  {viewReservation.occupants && viewReservation.occupants.length > 0 ? (
                    <div className="space-y-3">
                      {viewReservation.occupants.map((occupant, index) => {
                        const typeLabel =
                          occupant.type_occupant === "adulte"
                            ? "Adulte"
                            : occupant.type_occupant === "enfant"
                              ? "Enfant"
                              : "Bébé";
                        const typeIndex =
                          viewReservation.occupants!
                            .slice(0, index + 1)
                            .filter((item) => item.type_occupant === occupant.type_occupant)
                            .length;
                        const basePrice = Number(occupant.prix_unitaire) || 0;
                        const totalPrice = Number(occupant.prix_total) || 0;
                        const supplementPrice = Math.max(0, totalPrice - basePrice);

                        return (
                          <div
                            key={occupant.id ?? `${occupant.type_occupant}-${index}`}
                            className="rounded-2xl border border-slate-200 p-4"
                          >
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div>
                                <p className="text-[13px] font-semibold text-slate-900">
                                  {typeLabel} {typeIndex}
                                  {" · "}
                                  {[occupant.prenom, occupant.nom].filter(Boolean).join(" ") ||
                                    "—"}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {occupant.type_occupant === "enfant" &&
                                  occupant.age_enfant != null
                                    ? `${occupant.age_enfant} an${Number(occupant.age_enfant) > 1 ? "s" : ""}`
                                    : typeLabel}
                                  {occupant.tranche_age_nom
                                    ? ` · ${occupant.tranche_age_nom}`
                                    : ""}
                                </p>
                              </div>
                              <p className="text-[13px] font-semibold text-slate-800">
                                {formatMoney(totalPrice)}
                              </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <FicheInfoItem label="Prénom" value={occupant.prenom} />
                              <FicheInfoItem label="Nom" value={occupant.nom} />
                              <FicheInfoItem
                                label="Date de naissance"
                                value={
                                  occupant.date_naissance
                                    ? formatDateDisplay(occupant.date_naissance)
                                    : "—"
                                }
                              />
                              {occupant.type_occupant === "adulte" ? (
                                <FicheInfoItem
                                  label="Pièce d'identité"
                                  value={occupant.piece_identite || "—"}
                                />
                              ) : null}
                              {occupant.type_occupant === "enfant" ? (
                                <FicheInfoItem
                                  label="Âge"
                                  value={
                                    occupant.age_enfant != null
                                      ? `${occupant.age_enfant} an${Number(occupant.age_enfant) > 1 ? "s" : ""}`
                                      : "—"
                                  }
                                />
                              ) : null}
                              {occupant.type_occupant === "enfant" ? (
                                <FicheInfoItem
                                  label="Tranche d'âge"
                                  value={occupant.tranche_age_nom || "—"}
                                />
                              ) : null}
                              <FicheInfoItem
                                label="Supplément"
                                value={occupant.supplement_nom || "Aucun"}
                              />
                              <FicheInfoItem
                                label="Prix de base"
                                value={formatMoney(basePrice)}
                              />
                              {supplementPrice > 0 ? (
                                <FicheInfoItem
                                  label="Montant supplément"
                                  value={formatMoney(supplementPrice)}
                                />
                              ) : null}
                              <FicheInfoItem
                                label="Prix total"
                                value={formatMoney(totalPrice)}
                              />
                              {occupant.allergies_regime ? (
                                <FicheInfoItem
                                  label="Allergies / régime"
                                  value={occupant.allergies_regime}
                                />
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Tarification</h3>
                  <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
                    <FicheInfoItem
                      label="Prix chambre"
                      value={formatMoney(viewReservation.prix_chambre_total)}
                    />
                    <FicheInfoItem
                      label="Prix bébé"
                      value={formatMoney(viewReservation.prix_bebe_total)}
                    />
                    <FicheInfoItem
                      label="Prix enfants"
                      value={formatMoney(viewReservation.prix_enfants_total)}
                    />
                    <FicheInfoItem
                      label="Réduction"
                      value={
                        viewReservation.type_reduction &&
                        Number(viewReservation.valeur_reduction) > 0
                          ? `${
                              viewReservation.type_reduction === "%"
                                ? `${viewReservation.valeur_reduction} %`
                                : formatMoney(viewReservation.valeur_reduction)
                            } (−${formatMoney(
                              computeMontantReduction(
                                Number(viewReservation.prix_total_ht) +
                                  Number(viewReservation.montant_tva),
                                viewReservation.type_reduction,
                                Number(viewReservation.valeur_reduction)
                              )
                            )})`
                          : "Aucune"
                      }
                    />
                    <FicheInfoItem
                      label="Promotion"
                      value={viewReservation.promotion_nom || "Aucune"}
                    />
                    <FicheInfoItem
                      label="Code promo"
                      value={viewReservation.code_promo || "—"}
                    />
                    <FicheInfoItem
                      label="Suppléments"
                      value={(() => {
                        const occupants = viewReservation.occupants || [];
                        const total = occupants.reduce((sum, occupant) => {
                          const base = Number(occupant.prix_unitaire) || 0;
                          const totalPrice = Number(occupant.prix_total) || 0;
                          return sum + Math.max(0, totalPrice - base);
                        }, 0);
                        const count = occupants.filter((o) => o.supplement_nom).length;

                        if (count === 0 && total <= 0) {
                          return viewReservation.supplement_nom || "Aucun";
                        }

                        return `${count} occupant${count > 1 ? "s" : ""} · ${formatMoney(total)}`;
                      })()}
                    />
                    <FicheInfoItem
                      label="Taxe de séjour"
                      value={formatMoney(viewReservation.taxe_sejour_montant || 0)}
                    />
                  </div>
                  <div className="rounded-2xl border border-[#ddd6fe] bg-[#f5f3ff] px-4 py-4 text-[13px] text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span>Total HT</span>
                      <span className="font-medium">{formatMoney(viewReservation.prix_total_ht)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>TVA ({Number(viewReservation.taux_tva_applique) || 0}%)</span>
                      <span className="font-medium">{formatMoney(viewReservation.montant_tva)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ddd6fe] pt-3">
                      <span>Total TTC</span>
                      <span className="font-medium">{formatMoney(viewReservation.prix_total_ttc)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Taxe de séjour</span>
                      <span className="font-medium">
                        {formatMoney(viewReservation.taxe_sejour_montant || 0)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ddd6fe] pt-3 text-base font-semibold text-slate-900">
                      <span>Total à payer</span>
                      <span>
                        {formatMoney(
                          Number(viewReservation.prix_total_ttc) +
                            Number(viewReservation.taxe_sejour_montant || 0)
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-slate-500">
                      <span>Montant payé</span>
                      <span>{formatMoney(viewReservation.montant_paye)}</span>
                    </div>
                  </div>
                </section>

                {viewMaison ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Coordonnées de la maison
                    </h3>
                    <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
                      <FicheInfoItem label="Adresse" value={viewMaison.adresse} />
                      <FicheInfoItem
                        label="Localisation"
                        value={[viewMaison.code_postal, viewMaison.ville, viewMaison.pays]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                      <FicheInfoItem label="Téléphone" value={viewMaison.telephone} />
                      <FicheInfoItem label="Email" value={viewMaison.email} />
                      <FicheInfoItem label="Check-in" value={viewMaison.heure_checkin} />
                      <FicheInfoItem label="Check-out" value={viewMaison.heure_checkout} />
                    </div>
                    {viewMaison.description ? (
                      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-[13px] leading-relaxed text-slate-600">
                        {viewMaison.description}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {viewReservation.notes ? (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-600">
                      {viewReservation.notes}
                    </p>
                  </section>
                ) : null}
              </div>

              <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                <Button type="button" variant="outline" onClick={() => setViewSheetOpen(false)}>
                  Fermer
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setViewSheetOpen(false);
                    void openEdit(viewReservation);
                  }}
                >
                  Modifier la réservation
                </Button>
              </DialogFooter>
            </div>

              {showConfirmFloatingBtn &&
              viewReservation.statut_reservation === "en_attente" ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4 sm:bottom-24">
                  <Button
                    type="button"
                    className="pointer-events-auto rounded-full bg-emerald-600 px-5 py-6 text-[14px] font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
                    onClick={() => setConfirmTarget(viewReservation)}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Confirmer cette réservation
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer cette réservation ?</AlertDialogTitle>
            <AlertDialogDescription>
              La réservation « {confirmTarget?.reference} » passera au statut{" "}
              <strong>Confirmée</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmingReservation}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={confirmingReservation}
              onClick={(event) => {
                event.preventDefault();
                void confirmReservation();
              }}
            >
              {confirmingReservation ? "Confirmation…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette réservation ?</AlertDialogTitle>
            <AlertDialogDescription>
              La réservation « {deleteTarget?.reference} » sera définitivement supprimée.
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
