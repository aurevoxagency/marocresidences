import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";

import logo from "@/assets/logo.jpg";
import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { fetchCurrentUser, getAuthToken } from "@/lib/auth";
import { resolvePhotoUrl } from "@/lib/maisons";
import {
  createPublicReservation,
  fetchPublicBookingContext,
  type PublicBookingContext,
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
} from "@/lib/reservations";
import type { ChambreListItem } from "@/lib/hebergement";
import { cn } from "@/lib/utils";

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
  const [civilite, setCivilite] = useState("M.");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [notes, setNotes] = useState("");
  const [userSeed, setUserSeed] = useState<{ nom: string; prenom: string } | null>(null);
  const [occupants, setOccupants] = useState<OccupantDraft[]>(() =>
    buildOccupants(search.adults, childrenAges, babiesAges)
  );

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
        setChambreId((current) => {
          if (current && data.chambres.some((item) => String(item.id) === current)) {
            return current;
          }

          return data.chambres[0] ? String(data.chambres[0].id) : "";
        });
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

  const handleAuthSuccess = async () => {
    setIsAuthenticated(true);
    setAuthOpen(false);
  };

  const selectedChambre: ChambreListItem | undefined = useMemo(
    () => context?.chambres.find((item) => String(item.id) === chambreId),
    [context, chambreId]
  );

  const nbNuits = useMemo(
    () => calculateNights(dateArrivee, dateDepart),
    [dateArrivee, dateDepart]
  );

  const promotion = selectedChambre?.promotion ?? null;
  const supplements = context?.supplements || [];
  const saisonId = context?.saison_id ?? undefined;
  const nbEnfants = occupants.filter((item) => item.type_occupant === "enfant").length;
  const nbBebes = occupants.filter((item) => item.type_occupant === "bebe").length;

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
      promotion
    );
  };

  const pricing = useMemo(() => {
    if (!selectedChambre || nbNuits <= 0) {
      return {
        prixChambre: 0,
        prixBebe: 0,
        prixEnfants: 0,
        supplementTotal: 0,
        totals: calculateReservationTotals({
          prix_chambre_total: 0,
          prix_bebe_total: 0,
          prix_enfants_total: 0,
          supplement_total: 0,
          taux_tva_applique: Number(context?.maison.taux_tva) || 0,
        }),
      };
    }

    const adults = occupants.filter((item) => item.type_occupant === "adulte");
    const babies = occupants.filter((item) => item.type_occupant === "bebe");
    const children = occupants.filter((item) => item.type_occupant === "enfant");

    const adultStay =
      calculateChambreStayTotal(selectedChambre.prix_adulte, nbNuits, promotion) ?? 0;
    const prixChambre = Math.round(adultStay * adults.length * 100) / 100;

    const bebeStay = calculateBebeStayTotal(selectedChambre, nbNuits, promotion);
    const prixBebe = Math.round(bebeStay * babies.length * 100) / 100;

    const prixEnfants = children.reduce((total, child) => {
      return (
        total +
        calculateEnfantStayTotal(
          selectedChambre,
          nbNuits,
          child.age_enfant ?? 0,
          promotion
        )
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
          promotion
        )
      );
    }, 0);

    const totals = calculateReservationTotals({
      prix_chambre_total: prixChambre,
      prix_bebe_total: prixBebe,
      prix_enfants_total: prixEnfants,
      supplement_total: supplementTotal,
      taux_tva_applique: Number(context?.maison.taux_tva) || 0,
    });

    return { prixChambre, prixBebe, prixEnfants, supplementTotal, totals };
  }, [
    selectedChambre,
    nbNuits,
    occupants,
    promotion,
    context?.maison.taux_tva,
    context?.tranches_age,
    supplements,
    saisonId,
  ]);

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!context || !selectedChambre) {
      setFormError("Veuillez sélectionner une chambre.");
      return;
    }

    if (!dateArrivee || !dateDepart || nbNuits <= 0) {
      setFormError("Veuillez indiquer des dates valides (au moins une nuit).");
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
          calculateChambreStayTotal(selectedChambre.prix_adulte, nbNuits, promotion) ??
          0;
      } else if (occupant.type_occupant === "bebe") {
        prixUnitaire = calculateBebeStayTotal(selectedChambre, nbNuits, promotion);
      } else {
        prixUnitaire = calculateEnfantStayTotal(
          selectedChambre,
          nbNuits,
          age ?? 0,
          promotion
        );
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
      const result = await createPublicReservation({
        maison_id: context.maison.id,
        chambre_id: selectedChambre.id,
        date_arrivee: dateArrivee,
        date_depart: dateDepart,
        nb_adultes: adults.length,
        nbrs_enfants: children.length,
        nbrs_bebe: babies.length,
        age_enfant: children[0]?.age_enfant ?? 0,
        promotion_id: promotion?.id ?? null,
        type_reduction: null,
        valeur_reduction: 0,
        prix_chambre_total: pricing.prixChambre,
        prix_bebe_total: pricing.prixBebe,
        prix_enfants_total: pricing.prixEnfants,
        taux_tva_applique: Number(context.maison.taux_tva) || 0,
        prix_total_ht: pricing.totals.prix_total_ht,
        montant_tva: pricing.totals.montant_tva,
        prix_total_ttc: pricing.totals.prix_total_ttc,
        notes: notes.trim() || null,
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
      });

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
          "radial-gradient(circle at top left, #f7efe3 0%, #fbf8f3 45%, #f1ebe2 100%)",
      }}
    >
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Maroc Résidences" className="h-10 w-10 rounded-full object-cover" />
          <span className="font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
            Maroc Résidences
          </span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
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
          <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_28px_70px_-48px_rgba(58,52,42,0.65)]">
                <div className="relative h-52 sm:h-64">
                  <img
                    src={photo}
                    alt={context.maison.nom}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-white/80">
                      <MapPin className="h-3.5 w-3.5" />
                      {location || "Maroc"}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">{context.maison.nom}</h1>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                  Votre séjour
                </h2>
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
                <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                  Chambre
                </h2>
                <div className="mt-5 space-y-3">
                  {context.chambres.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune chambre active pour cette maison.
                    </p>
                  ) : (
                    context.chambres.map((chambre) => {
                      const selected = String(chambre.id) === chambreId;
                      const nightly = chambre.prix_adulte;

                      return (
                        <button
                          key={chambre.id}
                          type="button"
                          onClick={() => setChambreId(String(chambre.id))}
                          className={cn(
                            "w-full rounded-2xl border px-4 py-4 text-left transition",
                            selected
                              ? "border-[color:var(--olive-deep)] bg-[#f4f7f0]"
                              : "border-black/10 hover:border-black/20"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold" style={{ color: "var(--ink)" }}>
                                {chambre.nom}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {chambre.categorie_nom} · {chambre.type_nom}
                                {chambre.capacite_max
                                  ? ` · jusqu’à ${chambre.capacite_max} pers.`
                                  : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                {nightly != null
                                  ? `${Number(nightly).toLocaleString("fr-FR")} ${context.maison.devise || "MAD"}`
                                  : "Tarif N/D"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">/ nuit / adulte</p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                  Vos coordonnées
                </h2>
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
                <h2 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
                  Voyageurs
                </h2>
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
              <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_28px_70px_-48px_rgba(58,52,42,0.65)]">
                <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                  Récapitulatif
                </h2>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BedDouble className="h-4 w-4" />
                    {selectedChambre?.nom || "Aucune chambre"}
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Adultes</span>
                    <span>{pricing.prixChambre.toLocaleString("fr-FR")} MAD</span>
                  </div>
                  {nbEnfants > 0 ? (
                    <div className="flex justify-between gap-3">
                      <span>Enfants</span>
                      <span>{pricing.prixEnfants.toLocaleString("fr-FR")} MAD</span>
                    </div>
                  ) : null}
                  {nbBebes > 0 ? (
                    <div className="flex justify-between gap-3">
                      <span>Bébés</span>
                      <span>{pricing.prixBebe.toLocaleString("fr-FR")} MAD</span>
                    </div>
                  ) : null}
                  {pricing.supplementTotal > 0 ? (
                    <div className="flex justify-between gap-3">
                      <span>Suppléments</span>
                      <span>{pricing.supplementTotal.toLocaleString("fr-FR")} MAD</span>
                    </div>
                  ) : null}
                  {pricing.totals.montant_tva > 0 ? (
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <span>TVA</span>
                      <span>{pricing.totals.montant_tva.toLocaleString("fr-FR")} MAD</span>
                    </div>
                  ) : null}
                  <div className="border-t border-black/5 pt-3">
                    <div className="flex justify-between gap-3 text-base font-semibold">
                      <span>Total TTC</span>
                      <span style={{ color: "var(--olive-deep)" }}>
                        {pricing.totals.prix_total_ttc.toLocaleString("fr-FR")}{" "}
                        {context.maison.devise || "MAD"}
                      </span>
                    </div>
                  </div>
                </div>

                {formError ? (
                  <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={saving || !selectedChambre}
                  className="mt-6 h-12 w-full rounded-full text-sm font-semibold"
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
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  La réservation sera créée en attente de confirmation dans l’admin.
                </p>
              </div>
            </aside>
          </form>
        ) : null}
      </main>
    </div>
  );
}
