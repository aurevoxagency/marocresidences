import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  Tag,
  TicketPercent,
  Users,
  X,
} from "lucide-react";

import logo from "@/assets/logo.jpg";
import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { fetchCurrentUser, getAuthToken } from "@/lib/auth";
import { resolvePhotoUrl } from "@/lib/maisons";
import {
  createPublicReservation,
  fetchPublicBookingContext,
  validatePublicPromoCode,
  type PublicBookingContext,
  type PublicPromoCode,
} from "@/lib/public-booking";
import {
  calculateBebeStayTotal,
  calculateChambreStayTotal,
  calculateEnfantStayTotal,
  calculateNights,
  calculateOccupantSupplementStayTotal,
  calculateReservationTotals,
  resolveTrancheAgeId,
  type ReservationOccupantType,
  type ReservationTypeReduction,
} from "@/lib/reservations";
import type { ChambreListItem } from "@/lib/hebergement";
import { cn } from "@/lib/utils";

function mapPromoToReservationReduction(promo: PublicPromoCode): {
  type_reduction: ReservationTypeReduction;
  valeur_reduction: number;
} {
  return {
    type_reduction: promo.type_reduction === "pourcentage" ? "%" : "MAD",
    valeur_reduction: Number(promo.valeur_reduction) || 0,
  };
}

const ROOM_TYPE_BY_ADULTS: Record<number, string> = {
  1: "Single",
  2: "Double",
  3: "Triple",
  4: "Quadruple",
  5: "Quintuple",
};

function normalizeTypeNom(nom?: string | null) {
  return (nom || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function roomTypeForAdults(adults: number) {
  return ROOM_TYPE_BY_ADULTS[Math.min(5, Math.max(1, Math.floor(adults) || 1))] || "Double";
}

/** Pick chambre matching search adults (Single / Double / Triple…). */
function pickChambreForAdults(chambres: ChambreListItem[], adults: number) {
  if (chambres.length === 0) {
    return "";
  }

  const target = normalizeTypeNom(roomTypeForAdults(adults));
  const byType = chambres.find((chambre) => normalizeTypeNom(chambre.type_nom) === target);

  if (byType) {
    return String(byType.id);
  }

  const exactCap = chambres.find((chambre) => Number(chambre.capacite_max) === adults);
  if (exactCap) {
    return String(exactCap.id);
  }

  const larger = [...chambres]
    .filter((chambre) => Number(chambre.capacite_max) >= adults)
    .sort((a, b) => Number(a.capacite_max) - Number(b.capacite_max));

  if (larger[0]) {
    return String(larger[0].id);
  }

  return String(chambres[0].id);
}

type BookingSearch = {
  arrivee: string;
  depart: string;
  adults: number;
  enfants: string;
  bebes: string;
};

function parseAgeList(value: string) {
  if (!value.trim()) {
    return [] as number[];
  }

  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((age) => Number.isFinite(age) && age >= 0)
    .map((age) => Math.trunc(age));
}

export const Route = createFileRoute("/reserver/$maisonId")({
  component: ReserverPage,
  validateSearch: (search: Record<string, unknown>): BookingSearch => ({
    arrivee: typeof search.arrivee === "string" ? search.arrivee : "",
    depart: typeof search.depart === "string" ? search.depart : "",
    adults: Math.max(1, Number(search.adults) || 1),
    enfants: typeof search.enfants === "string" ? search.enfants : "",
    bebes: typeof search.bebes === "string" ? search.bebes : "",
  }),
});

type OccupantDraft = {
  key: string;
  type_occupant: ReservationOccupantType;
  nom: string;
  prenom: string;
  age_enfant: number | null;
  supplement_id: string;
  date_naissance: string;
  piece_identite: string;
};

function buildOccupants(
  adults: number,
  childrenAges: number[],
  babiesAges: number[],
  seedAdult?: { nom: string; prenom: string } | null
): OccupantDraft[] {
  const list: OccupantDraft[] = [];

  for (let i = 0; i < adults; i += 1) {
    list.push({
      key: `adulte-${i}`,
      type_occupant: "adulte",
      nom: i === 0 ? seedAdult?.nom || "" : "",
      prenom: i === 0 ? seedAdult?.prenom || "" : "",
      age_enfant: null,
      supplement_id: "",
      date_naissance: "",
      piece_identite: "",
    });
  }

  childrenAges.forEach((age, i) => {
    list.push({
      key: `enfant-${i}`,
      type_occupant: "enfant",
      nom: "",
      prenom: "",
      age_enfant: age,
      supplement_id: "",
      date_naissance: "",
      piece_identite: "",
    });
  });

  babiesAges.forEach((age, i) => {
    list.push({
      key: `bebe-${i}`,
      type_occupant: "bebe",
      nom: "",
      prenom: "",
      age_enfant: age,
      supplement_id: "",
      date_naissance: "",
      piece_identite: "",
    });
  });

  return list;
}

function occupantLabel(type: ReservationOccupantType, index: number) {
  if (type === "adulte") {
    return `Adulte ${index}`;
  }

  if (type === "enfant") {
    return `Enfant ${index}`;
  }

  return `Bébé ${index}`;
}

function ReserverPage() {
  const navigate = useNavigate();
  const { maisonId } = Route.useParams();
  const search = Route.useSearch();
  const numericMaisonId = Number(maisonId);

  const childrenAges = useMemo(() => parseAgeList(search.enfants), [search.enfants]);
  const babiesAges = useMemo(() => parseAgeList(search.bebes), [search.bebes]);

  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [authOpen, setAuthOpen] = useState(() => !getAuthToken());
  const [context, setContext] = useState<PublicBookingContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successReference, setSuccessReference] = useState("");

  const [dateArrivee, setDateArrivee] = useState(search.arrivee);
  const [dateDepart, setDateDepart] = useState(search.depart);
  const [chambreId, setChambreId] = useState("");
  const [litBebeSouhaite, setLitBebeSouhaite] = useState(false);
  const litBebeInputRef = useRef<HTMLInputElement>(null);
  const litBebeSouhaiteRef = useRef(false);
  const [civilite, setCivilite] = useState("M.");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [notes, setNotes] = useState("");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PublicPromoCode | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [userSeed, setUserSeed] = useState<{ nom: string; prenom: string } | null>(null);
  const [occupants, setOccupants] = useState<OccupantDraft[]>(() =>
    buildOccupants(search.adults, childrenAges, babiesAges)
  );

  const hasBebeFromSearch = babiesAges.length > 0;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    const token = getAuthToken();

    if (!token) {
      return;
    }

    void fetchCurrentUser(token)
      .then((user) => {
        if (cancelled) {
          return;
        }

        const lastName = user.last_name || "";
        const firstName = user.first_name || "";

        setNom(lastName);
        setPrenom(firstName);
        setEmail(user.email || "");
        setTelephone(user.phone || "");
        setUserSeed({ nom: lastName, prenom: firstName });
      })
      .catch(() => {
        // Keep empty fields if profile cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    setOccupants(buildOccupants(search.adults, childrenAges, babiesAges, userSeed));
  }, [search.adults, childrenAges, babiesAges, userSeed]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      setContext(null);
      return;
    }

    if (!Number.isFinite(numericMaisonId) || numericMaisonId <= 0) {
      setLoadError("Maison invalide.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError("");

    void fetchPublicBookingContext(numericMaisonId, dateArrivee || undefined)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setContext(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setContext(null);
          setLoadError(
            error instanceof Error ? error.message : "Impossible de charger la maison."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, numericMaisonId, dateArrivee]);

  useEffect(() => {
    if (!context) {
      setChambreId("");
      return;
    }

    setChambreId(pickChambreForAdults(context.chambres, search.adults));
  }, [context, search.adults]);

  useEffect(() => {
    if (!hasBebeFromSearch) {
      litBebeSouhaiteRef.current = false;
      setLitBebeSouhaite(false);
    }
  }, [hasBebeFromSearch]);

  useEffect(() => {
    if (!appliedPromo) {
      return;
    }

    setAppliedPromo(null);
    setPromoSuccess("");
    setPromoError("Les dates ont changé — réappliquez votre code promo.");
    // Intentionally omit appliedPromo from deps: only reset when dates change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateArrivee, dateDepart]);

  const handleAuthSuccess = async () => {
    setIsAuthenticated(true);
    setAuthOpen(false);
  };

  const selectedChambre: ChambreListItem | undefined = useMemo(
    () => context?.chambres.find((item) => String(item.id) === chambreId),
    [context, chambreId]
  );

  const expectedRoomType = roomTypeForAdults(search.adults);
  const litsBebeRestants = context?.maison.lits_bebe_disponibles
    ? Math.max(0, Number(context.maison.nb_lits_bebe) || 0)
    : 0;
  const canRequestLitBebe = hasBebeFromSearch && litsBebeRestants > 0;

  const nbNuits = useMemo(
    () => calculateNights(dateArrivee, dateDepart),
    [dateArrivee, dateDepart]
  );

  // Tarifs affichés/calculés au prix catalogue (sans promo chambre).
  // Seul un code promo validé applique une réduction sur le total TTC.
  const codeReduction = appliedPromo ? mapPromoToReservationReduction(appliedPromo) : null;
  const supplements = context?.supplements || [];
  const saisonId = context?.saison_id ?? undefined;
  const nbEnfants = occupants.filter((item) => item.type_occupant === "enfant").length;
  const nbBebes = occupants.filter((item) => item.type_occupant === "bebe").length;
  const devise = context?.maison.devise || "MAD";

  const getOccupantSupplementAmount = (occupant: OccupantDraft) => {
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
      occupant.age_enfant,
      nbNuits,
      context?.tranches_age || [],
      null
    );
  };

  const pricing = useMemo(() => {
    const taxeDeSejour = Number(context?.maison.taxe_de_sejour) || 0;
    const nbOccupants = occupants.length;

    if (!selectedChambre || nbNuits <= 0) {
      const emptyTotals = calculateReservationTotals({
        prix_chambre_total: 0,
        prix_bebe_total: 0,
        prix_enfants_total: 0,
        supplement_total: 0,
        taux_tva_applique: Number(context?.maison.taux_tva) || 0,
        taxe_de_sejour: taxeDeSejour,
        nb_nuits: Math.max(0, nbNuits),
        nb_occupants: nbOccupants,
      });

      return {
        prixChambre: 0,
        prixBebe: 0,
        prixEnfants: 0,
        supplementTotal: 0,
        totals: emptyTotals,
        totalsWithoutPromo: emptyTotals,
      };
    }

    const adults = occupants.filter((item) => item.type_occupant === "adulte");
    const babies = occupants.filter((item) => item.type_occupant === "bebe");
    const children = occupants.filter((item) => item.type_occupant === "enfant");

    const adultStay =
      calculateChambreStayTotal(selectedChambre.prix_adulte, nbNuits, null) ?? 0;
    const prixChambre = Math.round(adultStay * adults.length * 100) / 100;

    const bebeStay = calculateBebeStayTotal(selectedChambre, nbNuits, null);
    const prixBebe = Math.round(bebeStay * babies.length * 100) / 100;

    const prixEnfants = children.reduce((total, child) => {
      return (
        total +
        calculateEnfantStayTotal(selectedChambre, nbNuits, child.age_enfant ?? 0, null)
      );
    }, 0);

    const supplementTotal = occupants.reduce((total, occupant) => {
      if (!occupant.supplement_id) {
        return total;
      }

      const supplement = supplements.find(
        (item) => String(item.id) === occupant.supplement_id
      );

      return (
        total +
        calculateOccupantSupplementStayTotal(
          supplement,
          saisonId,
          occupant.type_occupant,
          occupant.age_enfant,
          nbNuits,
          context?.tranches_age || [],
          null
        )
      );
    }, 0);

    const totals = calculateReservationTotals({
      prix_chambre_total: prixChambre,
      prix_bebe_total: prixBebe,
      prix_enfants_total: prixEnfants,
      supplement_total: supplementTotal,
      type_reduction: codeReduction?.type_reduction ?? null,
      valeur_reduction: codeReduction?.valeur_reduction ?? 0,
      taux_tva_applique: Number(context?.maison.taux_tva) || 0,
      taxe_de_sejour: taxeDeSejour,
      nb_nuits: nbNuits,
      nb_occupants: nbOccupants,
    });

    const totalsWithoutPromo = calculateReservationTotals({
      prix_chambre_total: prixChambre,
      prix_bebe_total: prixBebe,
      prix_enfants_total: prixEnfants,
      supplement_total: supplementTotal,
      taux_tva_applique: Number(context?.maison.taux_tva) || 0,
      taxe_de_sejour: taxeDeSejour,
      nb_nuits: nbNuits,
      nb_occupants: nbOccupants,
    });

    return {
      prixChambre,
      prixBebe,
      prixEnfants,
      supplementTotal,
      totals,
      totalsWithoutPromo,
    };
  }, [
    selectedChambre,
    nbNuits,
    occupants,
    codeReduction?.type_reduction,
    codeReduction?.valeur_reduction,
    context?.maison.taux_tva,
    context?.maison.taxe_de_sejour,
    context?.tranches_age,
    supplements,
    saisonId,
  ]);

  const handleApplyPromo = async () => {
    if (!context) {
      return;
    }

    const code = promoCodeInput.trim();
    if (!code) {
      setPromoSuccess("");
      setPromoError("Code promo incorrect");
      return;
    }

    if (!dateArrivee || !dateDepart) {
      setPromoSuccess("");
      setPromoError("Indiquez d’abord vos dates de séjour.");
      return;
    }

    setPromoLoading(true);
    setPromoError("");
    setPromoSuccess("");
    setAppliedPromo(null);

    try {
      const result = await validatePublicPromoCode({
        code,
        maison_id: context.maison.id,
        chambre_id: selectedChambre?.id,
        date_arrivee: dateArrivee,
        date_depart: dateDepart,
      });
      setAppliedPromo(result.promotion);
      setPromoCodeInput(result.promotion.code_promo || code.toUpperCase());
      setPromoSuccess("Code promo appliqué — les prix ont été mis à jour.");
      setPromoError("");
    } catch {
      setAppliedPromo(null);
      setPromoSuccess("");
      setPromoError("Code promo incorrect");
    } finally {
      setPromoLoading(false);
    }
  };

  const clearPromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoError("");
    setPromoSuccess("");
  };

  const updateOccupant = (
    key: string,
    field: "nom" | "prenom" | "supplement_id" | "date_naissance" | "piece_identite",
    value: string
  ) => {
    setOccupants((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const syncFirstAdultField = (field: "nom" | "prenom", value: string) => {
    setOccupants((current) => {
      let firstAdultDone = false;
      return current.map((occupant) => {
        if (occupant.type_occupant !== "adulte" || firstAdultDone) {
          return occupant;
        }
        firstAdultDone = true;
        return { ...occupant, [field]: value };
      });
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    // Prefer ref (immune to stale closures) > DOM checkbox > FormData > state
    const formData = new FormData(event.currentTarget);
    const litBebeRequested =
      litBebeSouhaiteRef.current === true ||
      litBebeInputRef.current?.checked === true ||
      formData.get("lit_bebe") === "1" ||
      litBebeSouhaite === true;

    if (!context || !selectedChambre) {
      setFormError(
        `Aucune chambre ${expectedRoomType} disponible pour ${search.adults} adulte${search.adults > 1 ? "s" : ""}.`
      );
      return;
    }

    if (!dateArrivee || !dateDepart || nbNuits <= 0) {
      setFormError("Veuillez indiquer des dates valides (au moins une nuit).");
      return;
    }

    if (litBebeRequested && litsBebeRestants <= 0) {
      setFormError("Aucun lit bébé n’est disponible pour cette maison.");
      return;
    }

    if (!nom.trim() || !prenom.trim() || !email.trim() || !telephone.trim()) {
      setFormError("Veuillez renseigner vos coordonnées complètes.");
      return;
    }

    for (const occupant of occupants) {
      if (!occupant.nom.trim() || !occupant.prenom.trim()) {
        setFormError("Chaque voyageur doit avoir un nom et un prénom.");
        return;
      }
    }

    const adults = occupants.filter((item) => item.type_occupant === "adulte");
    const children = occupants.filter((item) => item.type_occupant === "enfant");
    const babies = occupants.filter((item) => item.type_occupant === "bebe");

    const occupantsPayload = occupants.map((occupant) => {
      const age = occupant.type_occupant === "enfant" ? occupant.age_enfant : null;
      let prixUnitaire = 0;

      if (occupant.type_occupant === "adulte") {
        prixUnitaire =
          calculateChambreStayTotal(selectedChambre.prix_adulte, nbNuits, null) ?? 0;
      } else if (occupant.type_occupant === "bebe") {
        prixUnitaire = calculateBebeStayTotal(selectedChambre, nbNuits, null);
      } else {
        prixUnitaire = calculateEnfantStayTotal(selectedChambre, nbNuits, age ?? 0, null);
      }

      const supplementAmount = getOccupantSupplementAmount(occupant);
      const prixTotal = Math.round((prixUnitaire + supplementAmount) * 100) / 100;

      return {
        type_occupant: occupant.type_occupant,
        nom: occupant.nom.trim(),
        prenom: occupant.prenom.trim(),
        age_enfant: age,
        tranche_age_id:
          occupant.type_occupant === "enfant"
            ? resolveTrancheAgeId(context.tranches_age, age ?? 0)
            : null,
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

    setSaving(true);

    try {
      const notesParts = [notes.trim()].filter(Boolean);
      const payload = {
        maison_id: context.maison.id,
        chambre_id: selectedChambre.id,
        date_arrivee: dateArrivee,
        date_depart: dateDepart,
        nb_adultes: adults.length,
        nbrs_enfants: children.length,
        nbrs_bebe: babies.length,
        lit_bebe: litBebeRequested ? 1 : 0,
        age_enfant: children[0]?.age_enfant ?? 0,
        promotion_id: appliedPromo?.id ?? null,
        code_promo: appliedPromo?.code_promo ?? null,
        type_reduction: codeReduction?.type_reduction ?? null,
        valeur_reduction: codeReduction?.valeur_reduction ?? 0,
        prix_chambre_total: pricing.prixChambre,
        prix_bebe_total: pricing.prixBebe,
        prix_enfants_total: pricing.prixEnfants,
        taux_tva_applique: Number(context.maison.taux_tva) || 0,
        prix_total_ht: pricing.totals.prix_total_ht,
        montant_tva: pricing.totals.montant_tva,
        prix_total_ttc: pricing.totals.prix_total_ttc,
        taxe_sejour_montant: pricing.totals.taxe_sejour_montant,
        notes: notesParts.length > 0 ? notesParts.join(" · ") : null,
        client: {
          civilite,
          nom: nom.trim(),
          prenom: prenom.trim(),
          email: email.trim(),
          telephone: telephone.trim(),
          date_naissance: adults[0]?.date_naissance || null,
          piece_identite: adults[0]?.piece_identite?.trim() || null,
        },
        occupants: occupantsPayload,
      };

      const result = await createPublicReservation(payload);

      setSuccessReference(result.reservation.reference);
    } catch (error: unknown) {
      setFormError(
        error instanceof Error ? error.message : "Impossible d'enregistrer la réservation."
      );
    } finally {
      setSaving(false);
    }
  };

  const photo = resolvePhotoUrl(context?.maison.photo_principale) || logo;
  const location = [
    context?.maison.quartier,
    context?.maison.ville,
    context?.maison.pays,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen"
        style={{
          background:
            "radial-gradient(circle at top left, #f7efe3 0%, #fbf8f3 45%, #f1ebe2 100%)",
        }}
      >
        <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Maroc Résidences" className="h-10 w-10 rounded-full object-cover" />
            <span className="font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
              Maroc Résidences
            </span>
          </Link>
        </header>
        <main className="mx-auto max-w-lg px-6 pb-16 pt-10 text-center">
          <h1 className="text-3xl font-semibold" style={{ color: "var(--ink)" }}>
            Connexion requise
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Pour réserver cette maison, créez un compte ou connectez-vous d’abord.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="rounded-full"
              style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
            >
              S’inscrire / Se connecter
            </Button>
            <Button type="button" variant="outline" className="rounded-full" asChild>
              <Link to="/">Retour à l’accueil</Link>
            </Button>
          </div>
        </main>
        <AuthDialog
          open={authOpen}
          onOpenChange={(open) => {
            setAuthOpen(open);
            if (!open && !getAuthToken()) {
              void navigate({ to: "/" });
            }
          }}
          defaultTab="register"
          message="Pour réserver cette maison, créez un compte ou connectez-vous d’abord."
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  if (successReference) {
    return (
      <div
        className="min-h-screen"
        style={{
          background:
            "radial-gradient(circle at top left, #f7efe3 0%, #fbf8f3 45%, #f1ebe2 100%)",
        }}
      >
        <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Maroc Résidences" className="h-10 w-10 rounded-full object-cover" />
            <span className="font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
              Maroc Résidences
            </span>
          </Link>
        </header>

        <main className="mx-auto max-w-3xl px-6 pb-16">
          <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_30px_80px_-50px_rgba(58,52,42,0.7)] sm:p-10">
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "color-mix(in oklab, var(--olive-deep) 12%, white)" }}
            >
              <CheckCircle2 className="h-7 w-7" style={{ color: "var(--olive-deep)" }} />
            </div>
            <h1 className="mt-5 text-3xl font-semibold" style={{ color: "var(--ink)" }}>
              Demande envoyée
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre réservation a été enregistrée avec le statut « en attente ».
              L’équipe confirmera bientôt votre séjour.
            </p>
            <div className="mt-6 rounded-2xl bg-[#f7f2ea] px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Référence</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--olive-deep)" }}>
                {successReference}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild style={{ background: "var(--olive-deep)" }}>
                <Link to="/">Retour à l’accueil</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 12% 0%, #f4efe6 0%, #fbf8f3 42%, #efe8dc 100%)",
      }}
    >
      <header className="border-b border-black/5 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logo}
              alt="Maroc Résidences"
              className="h-11 w-11 rounded-full object-cover ring-2 ring-[color:var(--olive-deep)]/15"
            />
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--terracotta)" }}
              >
                Réservation
              </p>
              <p className="font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
                Maroc Résidences
              </p>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-foreground/70 transition hover:border-black/20 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 pb-20">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement de la réservation…
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-red-800">
            {loadError}
          </div>
        ) : context ? (
          <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.4fr_0.85fr]">
            <div className="space-y-5">
              <section className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_28px_70px_-48px_rgba(58,52,42,0.65)]">
                <div className="relative h-56 sm:h-72">
                  <img
                    src={photo}
                    alt={context.maison.nom}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
                      <MapPin className="h-3.5 w-3.5" />
                      {location || "Maroc"}
                    </p>
                    <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                      {context.maison.nom}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-white/80">
                      Finalisez votre demande en quelques minutes — chambre attribuée selon
                      votre recherche.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{ background: "color-mix(in oklab, var(--olive-deep) 12%, white)" }}
                  >
                    <CalendarDays className="h-4 w-4" style={{ color: "var(--olive-deep)" }} />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                      Votre séjour
                    </h2>
                    <p className="text-xs text-muted-foreground">Dates d’arrivée et de départ</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Arrivée</span>
                    <input
                      type="date"
                      value={dateArrivee}
                      onChange={(e) => setDateArrivee(e.target.value)}
                      required
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Départ</span>
                    <input
                      type="date"
                      value={dateDepart}
                      onChange={(e) => setDateDepart(e.target.value)}
                      required
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {nbNuits > 0 ? `${nbNuits} nuit${nbNuits > 1 ? "s" : ""}` : "Dates à préciser"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {occupants.length} voyageur{occupants.length > 1 ? "s" : ""}
                  </span>
                </p>
              </section>

              <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{ background: "color-mix(in oklab, var(--olive-deep) 12%, white)" }}
                  >
                    <BedDouble className="h-4 w-4" style={{ color: "var(--olive-deep)" }} />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                      Chambre
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {search.adults} adulte{search.adults > 1 ? "s" : ""} → {expectedRoomType}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {!selectedChambre ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune chambre {expectedRoomType} disponible pour cette maison.
                    </p>
                  ) : (
                    <div className="w-full rounded-2xl border border-[color:var(--olive-deep)] bg-[#f4f7f0] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold" style={{ color: "var(--ink)" }}>
                            {selectedChambre.nom}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedChambre.categorie_nom} · {selectedChambre.type_nom}
                            {selectedChambre.capacite_max
                              ? ` · jusqu’à ${selectedChambre.capacite_max} pers.`
                              : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {selectedChambre.prix_adulte != null
                              ? `${Number(selectedChambre.prix_adulte).toLocaleString("fr-FR")} ${context.maison.devise || "MAD"}`
                              : "Tarif N/D"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            / nuit · {selectedChambre.type_nom || expectedRoomType}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {hasBebeFromSearch ? (
                  <div className="mt-5 rounded-2xl border border-black/5 bg-[#fbf8f3] px-4 py-4">
                    <label
                      className={cn(
                        "flex items-start gap-3 text-sm",
                        canRequestLitBebe ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                      )}
                    >
                      <input
                        ref={litBebeInputRef}
                        type="checkbox"
                        name="lit_bebe"
                        value="1"
                        className="mt-1 h-4 w-4 accent-[color:var(--olive-deep)]"
                        checked={litBebeSouhaite}
                        disabled={!canRequestLitBebe}
                        onChange={(e) => {
                          const next = e.target.checked;
                          litBebeSouhaiteRef.current = next;
                          setLitBebeSouhaite(next);
                        }}
                      />
                      <span>
                        <span className="font-medium" style={{ color: "var(--ink)" }}>
                          Voulez-vous un lit bébé ?
                        </span>
                        <span className="mt-1 block text-muted-foreground">
                          {context.maison.lits_bebe_disponibles
                            ? `Il nous reste ${litsBebeRestants} lit${litsBebeRestants > 1 ? "s" : ""} bébé.`
                            : "Aucun lit bébé n’est proposé pour cette maison."}
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5">
                  <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                    Vos coordonnées
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Contact principal de la réservation
                  </p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Civilité</span>
                    <select
                      value={civilite}
                      onChange={(e) => setCivilite(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                      <option value="Mlle">Mlle</option>
                    </select>
                  </label>
                  <div className="hidden sm:block" />
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Nom</span>
                    <input
                      value={nom}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNom(value);
                        syncFirstAdultField("nom", value);
                      }}
                      required
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Prénom</span>
                    <input
                      value={prenom}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPrenom(value);
                        syncFirstAdultField("prenom", value);
                      }}
                      required
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Téléphone</span>
                    <input
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      required
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl"
                    style={{ background: "color-mix(in oklab, var(--olive-deep) 12%, white)" }}
                  >
                    <Users className="h-4 w-4" style={{ color: "var(--olive-deep)" }} />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                      Voyageurs
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {occupants.length} voyageur{occupants.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  {occupants.map((occupant, index) => {
                    const typeIndex =
                      occupants
                        .slice(0, index + 1)
                        .filter((item) => item.type_occupant === occupant.type_occupant)
                        .length;

                    return (
                      <div
                        key={occupant.key}
                        className="rounded-2xl border border-black/5 bg-[#fbf8f3] p-4"
                      >
                        <p className="text-sm font-medium">
                          {occupantLabel(occupant.type_occupant, typeIndex)}
                          {occupant.type_occupant === "enfant" && occupant.age_enfant != null
                            ? ` · ${occupant.age_enfant} an${occupant.age_enfant > 1 ? "s" : ""}`
                            : ""}
                          {occupant.type_occupant === "bebe" && occupant.age_enfant != null
                            ? ` · ${occupant.age_enfant === 0 ? "<1 an" : `${occupant.age_enfant} an`}`
                            : ""}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <input
                            placeholder="Nom"
                            value={occupant.nom}
                            onChange={(e) => updateOccupant(occupant.key, "nom", e.target.value)}
                            required
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                          />
                          <input
                            placeholder="Prénom"
                            value={occupant.prenom}
                            onChange={(e) =>
                              updateOccupant(occupant.key, "prenom", e.target.value)
                            }
                            required
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                          />
                        </div>
                        {occupant.type_occupant === "adulte" ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="space-y-2 text-sm">
                              <span className="font-medium">Date de naissance</span>
                              <input
                                type="date"
                                value={occupant.date_naissance}
                                onChange={(e) =>
                                  updateOccupant(
                                    occupant.key,
                                    "date_naissance",
                                    e.target.value
                                  )
                                }
                                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                              />
                            </label>
                            <label className="space-y-2 text-sm">
                              <span className="font-medium">Pièce d’identité</span>
                              <input
                                value={occupant.piece_identite}
                                onChange={(e) =>
                                  updateOccupant(
                                    occupant.key,
                                    "piece_identite",
                                    e.target.value
                                  )
                                }
                                placeholder="N° CIN / passeport"
                                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                              />
                            </label>
                          </div>
                        ) : null}
                        {occupant.type_occupant === "adulte" && supplements.length > 0 ? (
                          <label className="mt-3 block space-y-2 text-sm">
                            <span className="font-medium">Supplément</span>
                            <select
                              value={occupant.supplement_id || "none"}
                              onChange={(e) =>
                                updateOccupant(
                                  occupant.key,
                                  "supplement_id",
                                  e.target.value === "none" ? "" : e.target.value
                                )
                              }
                              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            >
                              <option value="none">Aucun</option>
                              {supplements.map((supplement) => (
                                <option key={supplement.id} value={String(supplement.id)}>
                                  {supplement.nom}
                                </option>
                              ))}
                            </select>
                            {occupant.supplement_id ? (
                              <p className="text-xs text-muted-foreground">
                                {(() => {
                                  const amount = getOccupantSupplementAmount(occupant);
                                  return amount > 0
                                    ? `+ ${amount.toLocaleString("fr-FR")} MAD pour le séjour`
                                    : "Aucun tarif pour ce supplément sur cette saison.";
                                })()}
                              </p>
                            ) : null}
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <label className="mt-5 block space-y-2 text-sm">
                  <span className="font-medium">Notes (optionnel)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Demandes particulières, heure d’arrivée estimée…"
                  />
                </label>
              </section>
            </div>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_28px_70px_-48px_rgba(58,52,42,0.65)]">
                <div
                  className="px-6 py-4 text-sm font-semibold text-[color:var(--cream)]"
                  style={{ background: "var(--olive-deep)" }}
                >
                  Récapitulatif
                </div>
                <div className="space-y-4 p-6 text-sm">
                  <div className="rounded-2xl bg-[#f7f2ea] px-4 py-3">
                    <p className="inline-flex items-center gap-2 font-medium" style={{ color: "var(--ink)" }}>
                      <BedDouble className="h-4 w-4" style={{ color: "var(--olive-deep)" }} />
                      {selectedChambre?.nom || "Aucune chambre"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nbNuits > 0 ? `${nbNuits} nuit${nbNuits > 1 ? "s" : ""}` : "Dates à préciser"}
                      {" · "}
                      {occupants.length} voyageur{occupants.length > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Adultes</span>
                      <span className="font-medium">
                        {pricing.prixChambre.toLocaleString("fr-FR")} {devise}
                      </span>
                    </div>
                    {nbEnfants > 0 ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Enfants</span>
                        <span className="font-medium">
                          {pricing.prixEnfants.toLocaleString("fr-FR")} {devise}
                        </span>
                      </div>
                    ) : null}
                    {nbBebes > 0 ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Bébés</span>
                        <span className="font-medium">
                          {pricing.prixBebe.toLocaleString("fr-FR")} {devise}
                        </span>
                      </div>
                    ) : null}
                    {litBebeSouhaite ? (
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span>Lit bébé</span>
                        <span>Demandé</span>
                      </div>
                    ) : null}
                    {pricing.supplementTotal > 0 ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Suppléments</span>
                        <span className="font-medium">
                          {pricing.supplementTotal.toLocaleString("fr-FR")} {devise}
                        </span>
                      </div>
                    ) : null}
                    {pricing.totals.montant_tva > 0 ? (
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span>TVA</span>
                        <span>
                          {pricing.totals.montant_tva.toLocaleString("fr-FR")} {devise}
                        </span>
                      </div>
                    ) : null}
                    {pricing.totals.montant_reduction > 0 ? (
                      <div
                        className="flex justify-between gap-3 font-medium"
                        style={{ color: "var(--terracotta)" }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <TicketPercent className="h-3.5 w-3.5" />
                          Réduction{appliedPromo ? ` (${appliedPromo.code_promo})` : ""}
                        </span>
                        <span>
                          −{pricing.totals.montant_reduction.toLocaleString("fr-FR")} {devise}
                        </span>
                      </div>
                    ) : null}
                    {pricing.totals.taxe_sejour_montant > 0 ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Taxe de séjour</span>
                        <span className="font-medium">
                          {pricing.totals.taxe_sejour_montant.toLocaleString("fr-FR")} {devise}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-dashed border-black/10 bg-[#fbf8f3] p-4">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Tag className="h-3.5 w-3.5" />
                      Code promo
                    </p>
                    {appliedPromo ? (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold" style={{ color: "var(--olive-deep)" }}>
                              {appliedPromo.code_promo}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {appliedPromo.nom}
                              {" · "}
                              {appliedPromo.type_reduction === "pourcentage"
                                ? `−${appliedPromo.valeur_reduction} %`
                                : `−${Number(appliedPromo.valeur_reduction).toLocaleString("fr-FR")} MAD`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={clearPromo}
                            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
                            aria-label="Retirer le code promo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                          {promoSuccess || "Code promo appliqué — les prix ont été mis à jour."}
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          value={promoCodeInput}
                          onChange={(e) => {
                            setPromoCodeInput(e.target.value.toUpperCase());
                            setPromoError("");
                            setPromoSuccess("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleApplyPromo();
                            }
                          }}
                          placeholder="EX: ETE2026"
                          className="h-10 flex-1 rounded-xl border border-input bg-white px-3 text-sm uppercase tracking-wide"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={promoLoading}
                          onClick={() => void handleApplyPromo()}
                          className="h-10 rounded-xl px-4"
                        >
                          {promoLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Appliquer"
                          )}
                        </Button>
                      </div>
                    )}
                    {promoError ? (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                        {promoError}
                      </p>
                    ) : null}
                  </div>

                  <div className="border-t border-black/5 pt-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Total à payer
                        </p>
                        {appliedPromo &&
                        pricing.totalsWithoutPromo.total_a_payer >
                          pricing.totals.total_a_payer ? (
                          <p className="mt-0.5 text-sm text-muted-foreground line-through">
                            {pricing.totalsWithoutPromo.total_a_payer.toLocaleString("fr-FR")}{" "}
                            {devise}
                          </p>
                        ) : null}
                        <p
                          className="mt-0.5 text-2xl font-semibold"
                          style={{ color: "var(--olive-deep)" }}
                        >
                          {pricing.totals.total_a_payer.toLocaleString("fr-FR")} {devise}
                        </p>
                      </div>
                    </div>
                  </div>

                  {formError ? (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={saving || !selectedChambre}
                    className="h-12 w-full rounded-full text-sm font-semibold"
                    style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Envoi…
                      </>
                    ) : (
                      "Confirmer la réservation"
                    )}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Votre demande sera créée en attente de confirmation.
                  </p>
                </div>
              </div>
            </aside>
          </form>
        ) : null}
      </main>
    </div>
  );
}
