import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  MapPin,
  CalendarDays,
  Users,
  ShieldCheck,
  BadgeCheck,
  Headphones,
  Star,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Minus,
  Plus,
  BedDouble,
  Clock3,
  Wifi,
  Sparkles,
  Phone,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Menu,
} from "lucide-react";

import { format, parseISO } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import logo from "@/assets/header-maroc-residences-removebg-preview.png";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HomeFloatingWidgets } from "@/components/home-floating-widgets";
import { AuthDialog } from "@/components/auth-dialog";
import { LanguageFlag } from "@/components/language-flag";
import { CurrencyFlag } from "@/components/currency-flag";
import { RevealOnScroll, RevealItem } from "@/components/reveal-on-scroll";
import { CurrencyProvider, useCurrency } from "@/components/currency-provider";
import { LanguageProvider, useLanguage } from "@/components/language-provider";
import {
  LANGUAGE_OPTIONS,
  type AppLanguage,
  type HomeTranslations,
} from "@/lib/i18n";
import {
  AUTH_CHANGED_EVENT,
  clearAuthToken,
  fetchCurrentUser,
  getAuthToken,
  type AuthUser,
} from "@/lib/auth";
import {
  CURRENCY_OPTIONS,
  currencyLabel,
  formatMoney,
  isAppCurrency,
} from "@/lib/currency";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { createPublicAvis, fetchPublishedAvis, type PublishedAvis } from "@/lib/avis-clients";
import {
  fetchMaisonsCatalog,
  resolvePhotoUrl,
  type MaisonListItem,
} from "@/lib/maisons";
import { fetchPublicBookingContext } from "@/lib/public-booking";
import heroVideo from "@/assets/herosection.mp4";
import destMarrakech from "@/assets/dest-marrakech.jpg";
import destChefchaouen from "@/assets/dest-chefchaouen.jpg";
import destEssaouira from "@/assets/dest-essaouira.jpg";
import destMerzouga from "@/assets/dest-merzouga.jpg";
import house1 from "@/assets/house-1.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { property: "og:image", content: logo },
    ],
  }),
});

const destinationFallbackImages: Record<string, string> = {
  marrakech: destMarrakech,
  chefchaouen: destChefchaouen,
  essaouira: destEssaouira,
  merzouga: destMerzouga,
};

function buildDestinationCards(maisons: MaisonListItem[]) {
  const byVille = new Map<
    string,
    { name: string; count: number; photo: string | null }
  >();

  for (const maison of maisons) {
    const ville = (maison.ville || "").trim();

    if (!ville) {
      continue;
    }

    const key = ville.toLowerCase();
    const current = byVille.get(key);

    if (current) {
      current.count += 1;
      if (!current.photo && maison.photo_principale) {
        current.photo = maison.photo_principale;
      }
    } else {
      byVille.set(key, {
        name: ville,
        count: 1,
        photo: maison.photo_principale || null,
      });
    }
  }

  return Array.from(byVille.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"))
    .map((item) => {
      const key = item.name.toLowerCase();
      const fallback =
        Object.entries(destinationFallbackImages).find(([city]) =>
          key.includes(city)
        )?.[1] || destMarrakech;

      return {
        name: item.name,
        count: item.count,
        img: resolvePhotoUrl(item.photo) || fallback,
      };
    });
}

function getDestinationCities(maisons: MaisonListItem[]) {
  return buildDestinationCards(maisons).map((item) => item.name);
}

type DialogMaison = MaisonListItem & {
  photos?: Array<{ url?: string | null }>;
};

function MaisonDetailsDialog({
  maison,
  onClose,
  priceHint,
  primaryLabel,
  onPrimary,
}: {
  maison: DialogMaison | null;
  onClose: () => void;
  priceHint: string;
  primaryLabel: string;
  onPrimary: (maison: MaisonListItem) => void;
}) {
  const { currency } = useCurrency();
  const { t } = useLanguage();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [hoverPreview, setHoverPreview] = useState(false);
  const maisonPhotos = useMemo(() => {
    if (!maison) {
      return [];
    }

    const fromMaison = Array.isArray((maison as { photos?: Array<{ url?: string | null }> }).photos)
      ? (maison as { photos?: Array<{ url?: string | null }> }).photos || []
      : [];

    const urls = fromMaison
      .map((photo) => resolvePhotoUrl(photo?.url || ""))
      .filter(Boolean) as string[];

    const primary = resolvePhotoUrl(maison.photo_principale) || "";
    const merged = primary ? [primary, ...urls] : urls;

    return Array.from(new Set(merged));
  }, [maison]);

  useEffect(() => {
    setPhotoIndex(0);
    setHoverPreview(false);
  }, [maison?.id]);

  const currentPhoto =
    maisonPhotos[photoIndex] ||
    (maison ? resolvePhotoUrl(maison.photo_principale) || house1 : house1);

  const showPrevPhoto = () => {
    if (maisonPhotos.length <= 1) {
      return;
    }

    setPhotoIndex((current) => (current - 1 + maisonPhotos.length) % maisonPhotos.length);
  };

  const showNextPhoto = () => {
    if (maisonPhotos.length <= 1) {
      return;
    }

    setPhotoIndex((current) => (current + 1) % maisonPhotos.length);
  };

  return (
    <Dialog
      open={Boolean(maison)}
      onOpenChange={(open) => {
        if (!open) {
          setHoverPreview(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-2xl">
        {maison ? (
          <>
            <div
              className="group relative h-48 w-full cursor-zoom-in overflow-hidden sm:h-56"
              onMouseEnter={() => setHoverPreview(true)}
              onMouseLeave={() => setHoverPreview(false)}
            >
              <img
                src={currentPhoto}
                alt={maison.nom}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              {maisonPhotos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPrevPhoto}
                    className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white backdrop-blur transition hover:bg-black/50"
                    aria-label="Photo précédente"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextPhoto}
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white backdrop-blur transition hover:bg-black/50"
                    aria-label="Photo suivante"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                    {photoIndex + 1} / {maisonPhotos.length}
                  </div>
                </>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/80">
                  <MapPin className="h-3.5 w-3.5" />
                  {[maison.quartier, maison.ville, maison.pays].filter(Boolean).join(" · ") ||
                    "Maroc"}
                </p>
                <DialogHeader className="mt-1 space-y-0 p-0 text-left">
                  <DialogTitle className="text-2xl text-white sm:text-3xl">
                    {maison.nom}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Détails de {maison.nom}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
            {maisonPhotos.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-5">
                {maisonPhotos.map((photo, index) => (
                  <button
                    key={`${photo}-${index}`}
                    type="button"
                    onClick={() => setPhotoIndex(index)}
                    className={`group h-16 w-24 shrink-0 overflow-hidden rounded-lg border transition ${
                      photoIndex === index ? "border-[#3f5b2d]" : "border-black/10"
                    }`}
                    aria-label={`Photo ${index + 1}`}
                  >
                    <img
                      src={photo}
                      alt={`${maison.nom} ${index + 1}`}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            ) : null}

            {hoverPreview ? (
              <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-6">
                <img
                  src={currentPhoto}
                  alt=""
                  className="max-h-[70vh] max-w-[min(70vw,28rem)] rounded-2xl object-contain shadow-2xl ring-4 ring-white"
                />
              </div>
            ) : null}

            <div className="space-y-5 p-5 sm:p-6">
              {maison.categorie ? (
                <span className="inline-flex rounded-full bg-[#f7f2ea] px-3 py-1 text-xs font-semibold text-foreground/70">
                  {maison.categorie}
                </span>
              ) : null}

              <p className="text-sm leading-relaxed text-muted-foreground">
                {maison.description?.trim() || t.results.defaultDescription}
              </p>

              {maison.adresse ? (
                <p className="text-sm text-foreground/70">
                  <span className="font-medium text-foreground">Adresse · </span>
                  {maison.adresse}
                  {maison.code_postal ? `, ${maison.code_postal}` : ""}
                  {maison.ville ? ` · ${maison.ville}` : ""}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#f7f2ea] px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">
                    Chambres disponibles
                  </p>
                  <p className="mt-1 text-lg font-semibold">{maison.nb_chambres || "—"}</p>
                </div>
                <div className="rounded-2xl bg-[#f7f2ea] px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">
                    Horaire
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    CheckIn : {(maison.heure_checkin || "14:00").slice(0, 5)}
                    <br />
                    CheckOut : {(maison.heure_checkout || "12:00").slice(0, 5)}
                  </p>
                </div>
                <div className="hidden rounded-2xl bg-[#f7f2ea] px-3.5 py-3 sm:block" />
              </div>

              {(maison.services || []).length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/45">
                    Services
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {maison.services!.map((item) => (
                      <span
                        key={`svc-${item}`}
                        className="rounded-full border border-black/5 bg-[#fbf8f2] px-3 py-1.5 text-xs font-medium text-foreground/75"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {(maison.equipements || []).length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/45">
                    Équipements
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {maison.equipements!.map((item) => (
                      <span
                        key={`eq-${item}`}
                        className="rounded-full border border-black/5 bg-[#fbf8f2] px-3 py-1.5 text-xs font-medium text-foreground/75"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/70">
                {maison.telephone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-4 w-4" /> {maison.telephone}
                  </span>
                ) : null}
                {maison.whatsapp ? <span>WhatsApp {maison.whatsapp}</span> : null}
                {maison.email ? <span>{maison.email}</span> : null}
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4" style={{ color: "var(--olive-deep)" }} />
                  {t.results.verified}
                </span>
              </div>

              <div className="rounded-2xl border border-black/5 bg-[#fbf8f3] px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t.results.pricingFrom}
                </p>
                <p className="mt-0.5 text-xl font-semibold" style={{ color: "var(--ink)" }}>
                  {maison.prix_adulte_min != null && Number(maison.prix_adulte_min) > 0
                    ? formatMoney(
                        Number(maison.prix_adulte_min),
                        currency,
                        isAppCurrency(maison.devise) ? maison.devise : "MAD"
                      )
                    : currencyLabel(currency)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {priceHint}
                  </span>
                </p>
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-black/10 transition hover:bg-[#f7f2ea]"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => onPrimary(maison)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition"
                  style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                >
                  {primaryLabel} <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </DialogFooter>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type VoyageursState = {
  adults: number;
  childrenAges: number[];
  babiesAges: number[];
};

type SearchCriteria = {
  destination: string;
  dateArrivee: string;
  dateDepart: string;
  voyageurs: VoyageursState;
};

function toIsoDate(date?: Date) {
  if (!date) {
    return "";
  }

  return format(date, "yyyy-MM-dd");
}

function startOfLocalToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function fromIsoDate(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    return parseISO(value);
  } catch {
    return undefined;
  }
}

function dateFnsLocale(language: AppLanguage) {
  return language === "en" ? enUS : fr;
}

function formatDatesLabel(
  dateArrivee: string,
  dateDepart: string,
  language: AppLanguage,
  datesPlaceholder: string
) {
  const locale = dateFnsLocale(language);
  const arrivee = fromIsoDate(dateArrivee);
  const depart = fromIsoDate(dateDepart);

  if (arrivee && depart) {
    return `${format(arrivee, "d MMM", { locale })} — ${format(depart, "d MMM yyyy", { locale })}`;
  }

  if (arrivee) {
    const departLabel = language === "en" ? "Check-out" : "Départ";
    return `${format(arrivee, "d MMM yyyy", { locale })} — ${departLabel}`;
  }

  return datesPlaceholder;
}

function formatVoyageursLabel(
  voyageurs: VoyageursState,
  search: Pick<HomeTranslations["search"], "adult" | "child" | "baby">
) {
  const parts = [search.adult(voyageurs.adults)];

  if (voyageurs.childrenAges.length > 0) {
    parts.push(search.child(voyageurs.childrenAges.length));
  }

  if (voyageurs.babiesAges.length > 0) {
    parts.push(search.baby(voyageurs.babiesAges.length));
  }

  return parts.join(", ");
}

function roomTypeCapacity(adults: number) {
  return Math.max(1, Math.floor(adults) || 1);
}

const advantageIcons = [ShieldCheck, BadgeCheck, Headphones] as const;

function Nav({
  destinations,
  onSelectDestination,
}: {
  destinations: string[];
  onSelectDestination?: (ville: string) => void;
}) {
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      const token = getAuthToken();

      if (!token) {
        if (!cancelled) {
          setUser(null);
        }
        return;
      }

      try {
        const currentUser = await fetchCurrentUser(token);
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        clearAuthToken();
        if (!cancelled) {
          setUser(null);
        }
      }
    };

    void loadUser();

    const onAuthChanged = () => {
      void loadUser();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (authOpen) return;
      setScrolled(window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [authOpen]);

  useEffect(() => {
    if (!authOpen) {
      setScrolled(window.scrollY > 20);
    }
  }, [authOpen]);

  const displayName = user
    ? `${user.first_name} ${user.last_name}`.trim()
    : "";

  return (
    <>
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter,border-color] duration-300",
        scrolled || authOpen
          ? "border-b border-black/5 bg-white/80 shadow-md backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4 lg:px-10">
        <a href="#" className="shrink-0">
          <img
            src={logo}
            alt="Maroc Résidences"
            className={cn(
              "h-12 w-auto max-w-[240px] object-contain transition duration-300 sm:h-14 sm:max-w-[300px]",
              !scrolled && !authOpen && "drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]",
            )}
          />
        </a>

        <nav
          className={cn(
            "ml-2 hidden min-w-0 flex-1 items-center justify-center gap-6 text-base font-medium transition-colors duration-300 lg:flex xl:gap-8",
            scrolled || authOpen ? "text-foreground/80" : "text-white/90",
          )}
        >
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="inline-flex shrink-0 items-center gap-1.5 opacity-90 outline-none transition-opacity hover:opacity-100 data-[state=open]:opacity-100">
              {t.nav.destinations}
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {destinations.length === 0 ? (
                <DropdownMenuItem disabled>Aucune destination</DropdownMenuItem>
              ) : (
                destinations.map((city) => (
                  <DropdownMenuItem
                    key={city}
                    className="cursor-pointer"
                    onSelect={(event) => {
                      event.preventDefault();
                      onSelectDestination?.(city);
                    }}
                  >
                    {city}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <a href="#maisons" className="opacity-80 transition hover:opacity-100">{t.nav.maisons}</a>
          <a href="#experiences" className="opacity-80 transition hover:opacity-100">{t.nav.experiences}</a>
          <a href="#avis" className="opacity-80 transition hover:opacity-100">{t.nav.avis}</a>
          <a href="#faq" className="opacity-80 transition hover:opacity-100">{t.nav.faq}</a>
          <a href="#contact" className="opacity-80 transition hover:opacity-100">{t.nav.aide}</a>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={cn(
                "group inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tracking-wide outline-none transition sm:h-10 sm:gap-2 sm:px-3.5 sm:text-sm",
                scrolled || authOpen
                  ? "bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--olive)_12%,white)] data-[state=open]:bg-[color-mix(in_oklab,var(--olive)_14%,white)] data-[state=open]:text-[var(--olive-deep)]"
                  : "bg-white/15 text-white hover:bg-white/25 data-[state=open]:bg-white/25",
                "focus-visible:ring-2 focus-visible:ring-[var(--olive)]/40",
              )}
              aria-label={t.nav.language}
            >
              <LanguageFlag code={language} className="h-[14px] w-[21px] sm:h-4 sm:w-6" />
              <span>{language.toUpperCase()}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50 transition group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[7.5rem] rounded-xl p-1.5">
              {LANGUAGE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.code}
                  onClick={() => setLanguage(option.code)}
                  className={cn(
                    "cursor-pointer gap-2.5 rounded-lg text-sm font-medium",
                    language === option.code && "bg-[color-mix(in_oklab,var(--olive)_12%,white)] text-[var(--olive-deep)]",
                  )}
                >
                  <LanguageFlag code={option.code} />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={cn(
                "group inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tracking-wide outline-none transition sm:h-10 sm:gap-2 sm:px-3.5 sm:text-sm",
                scrolled || authOpen
                  ? "bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--olive)_12%,white)] data-[state=open]:bg-[color-mix(in_oklab,var(--olive)_14%,white)] data-[state=open]:text-[var(--olive-deep)]"
                  : "bg-white/15 text-white hover:bg-white/25 data-[state=open]:bg-white/25",
                "focus-visible:ring-2 focus-visible:ring-[var(--olive)]/40",
              )}
              aria-label={t.nav.currency}
            >
              <CurrencyFlag code={currency} className="h-[14px] w-[21px] sm:h-4 sm:w-6" />
              <span>{currency}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50 transition group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[7.5rem] rounded-xl p-1.5">
              {CURRENCY_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.code}
                  onClick={() => setCurrency(option.code)}
                  className={cn(
                    "cursor-pointer gap-2.5 rounded-lg text-sm font-medium",
                    currency === option.code && "bg-[color-mix(in_oklab,var(--olive)_12%,white)] text-[var(--olive-deep)]",
                  )}
                >
                  <CurrencyFlag code={option.code} />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                className={cn(
                  "group inline-flex h-8 items-center gap-1.5 rounded-full pl-0.5 pr-2 text-sm font-medium outline-none transition sm:h-9 sm:gap-2 sm:pr-3",
                  scrolled || authOpen
                    ? "bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--olive)_12%,white)] data-[state=open]:bg-[color-mix(in_oklab,var(--olive)_14%,white)]"
                    : "bg-white/15 text-white hover:bg-white/25 data-[state=open]:bg-white/25",
                  "focus-visible:ring-2 focus-visible:ring-[var(--olive)]/40",
                )}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold tracking-wide"
                  style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                >
                  {(user.first_name?.[0] || "").toUpperCase()}
                  {(user.last_name?.[0] || "").toUpperCase()}
                </span>
                <span className="hidden max-w-[120px] truncate md:inline">{displayName}</span>
                <ChevronDown className="hidden h-3 w-3 opacity-50 transition group-data-[state=open]:rotate-180 sm:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44 rounded-xl p-1.5">
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg"
                  onClick={() => {
                    clearAuthToken();
                    setUser(null);
                  }}
                >
                  {t.nav.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className={cn(
                "inline-flex h-8 max-w-[7.5rem] items-center justify-center truncate rounded-full px-2.5 text-[11px] font-semibold tracking-wide outline-none transition sm:h-9 sm:max-w-none sm:px-4 sm:text-sm",
                "shadow-[0_8px_20px_-12px_rgba(58,70,40,0.55)]",
                "hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--olive)]/50",
              )}
              style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
            >
              {t.nav.login}
            </button>
          )}

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full transition lg:hidden",
                  scrolled || authOpen
                    ? "bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--olive)_12%,white)]"
                    : "bg-white/15 text-white hover:bg-white/25",
                )}
                aria-label="Menu"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100vw-2rem,20rem)] px-0">
              <SheetHeader className="border-b border-border px-5 pb-4 text-left">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-3 py-4 text-sm">
                {destinations.length === 0 ? (
                  <p className="px-3 py-2.5 text-foreground/50">Aucune destination</p>
                ) : (
                  destinations.map((city) => (
                    <button
                      key={city}
                      type="button"
                      className="rounded-xl px-3 py-2.5 text-left text-foreground/80 transition hover:bg-muted hover:text-foreground"
                      onClick={() => {
                        setMobileNavOpen(false);
                        onSelectDestination?.(city);
                      }}
                    >
                      {city}
                    </button>
                  ))
                )}
                <div className="my-2 border-t border-border" />
                {(
                  [
                    ["#maisons", t.nav.maisons],
                    ["#experiences", t.nav.experiences],
                    ["#avis", t.nav.avis],
                    ["#faq", t.nav.faq],
                    ["#contact", t.nav.aide],
                  ] as const
                ).map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    className="rounded-xl px-3 py-2.5 text-foreground/80 transition hover:bg-muted hover:text-foreground"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}

function SearchBar({
  maisons,
  onSearch,
}: {
  maisons: MaisonListItem[];
  onSearch: (criteria: SearchCriteria) => void;
}) {
  const { language, t } = useLanguage();
  const calendarLocale = dateFnsLocale(language);
  const [dest, setDest] = useState("");
  const [dateArrivee, setDateArrivee] = useState("");
  const [dateDepart, setDateDepart] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);
  const [voyageurs, setVoyageurs] = useState<VoyageursState>({
    adults: 2,
    childrenAges: [],
    babiesAges: [],
  });
  const [destOpen, setDestOpen] = useState(false);
  const [voyageursOpen, setVoyageursOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const destBoxRef = useRef<HTMLDivElement>(null);

  const dateRange: DateRange | undefined = useMemo(() => {
    const from = fromIsoDate(dateArrivee);
    const to = fromIsoDate(dateDepart);

    if (!from && !to) {
      return undefined;
    }

    return { from, to };
  }, [dateArrivee, dateDepart]);

  const destinationSuggestions = useMemo(() => {
    const query = dest.trim().toLowerCase();
    const cities = Array.from(
      new Set(
        maisons
          .map((maison) => maison.ville?.trim())
          .filter((ville): ville is string => Boolean(ville))
      )
    ).sort((a, b) => a.localeCompare(b, "fr"));

    const quartiers = Array.from(
      new Set(
        maisons
          .map((maison) =>
            [maison.quartier?.trim(), maison.ville?.trim()].filter(Boolean).join(", ")
          )
          .filter(Boolean)
      )
    );

    const names = maisons.map((maison) => maison.nom);

    const pool = [
      ...cities.map((ville) => ({ label: ville, kind: "Ville" as const })),
      ...quartiers.map((label) => ({ label, kind: "Quartier" as const })),
      ...names.map((label) => ({ label, kind: "Maison" as const })),
    ];

    const filtered = query
      ? pool.filter((item) => item.label.toLowerCase().includes(query))
      : [];

    const seen = new Set<string>();
    return filtered.filter((item) => {
      const key = item.label.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [dest, maisons]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!destBoxRef.current?.contains(event.target as Node)) {
        setDestOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const updateChildrenCount = (nextCount: number) => {
    setVoyageurs((current) => {
      const count = Math.max(0, Math.min(6, nextCount));
      const childrenAges = [...current.childrenAges];

      while (childrenAges.length < count) {
        childrenAges.push(-1);
      }

      return {
        ...current,
        childrenAges: childrenAges.slice(0, count),
      };
    });
  };

  const updateBabiesCount = (nextCount: number) => {
    setVoyageurs((current) => {
      const count = Math.max(0, Math.min(4, nextCount));
      const babiesAges = [...current.babiesAges];

      while (babiesAges.length < count) {
        babiesAges.push(-1);
      }

      return {
        ...current,
        babiesAges: babiesAges.slice(0, count),
      };
    });
  };

  const handleSearch = () => {
    const destination = dest.trim();

    if (!destination) {
      setSearchError(t.search.errorDestination);
      setDestOpen(true);
      return;
    }

    if (!dateArrivee || !dateDepart) {
      setSearchError(t.search.errorDates);
      setDatesOpen(true);
      return;
    }

    if (voyageurs.adults < 1) {
      setSearchError(t.search.errorTravelers);
      setVoyageursOpen(true);
      return;
    }

    const missingChildAge = voyageurs.childrenAges.some((age) => age < 0);
    const missingBabyAge = voyageurs.babiesAges.some((age) => age < 0);

    if (missingChildAge || missingBabyAge) {
      setSearchError(t.search.errorAges);
      setVoyageursOpen(true);
      return;
    }

    setSearchError("");
    onSearch({
      destination,
      dateArrivee,
      dateDepart,
      voyageurs,
    });
  };

  return (
    <div className="glass mx-auto mt-8 w-full min-w-0 max-w-5xl rounded-3xl p-1.5 sm:mt-14 sm:rounded-4xl sm:p-3">
      <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[1.4fr_1.2fr_1.1fr_auto]">
        <div ref={destBoxRef} className="relative min-w-0 rounded-2xl px-4 py-3.5 transition hover:bg-white/60 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
            <MapPin className="h-3.5 w-3.5" /> {t.search.destination}
          </div>
          <input
            value={dest}
            onChange={(e) => {
              const value = e.target.value;
              setDest(value);
              setSearchError("");
              setDestOpen(value.trim().length > 0);
            }}
            onFocus={() => {
              if (dest.trim().length > 0) {
                setDestOpen(true);
              }
            }}
            placeholder={t.search.destinationPlaceholder}
            className="mt-1 w-full bg-transparent text-[15px] font-medium text-foreground placeholder:text-foreground/40 focus:outline-none"
            autoComplete="off"
          />
          {destOpen && dest.trim().length > 0 && destinationSuggestions.length > 0 ? (
            <div className="absolute left-2 right-2 top-[calc(100%-4px)] z-30 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-float">
              {destinationSuggestions.map((item) => (
                <button
                  key={`${item.kind}-${item.label}`}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                  onClick={() => {
                    setDest(item.label.split(",")[0]?.trim() || item.label);
                    setDestOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-foreground/40" />
                    {item.label}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-foreground/40">
                    {item.kind}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Popover open={datesOpen} onOpenChange={setDatesOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full min-w-0 rounded-2xl px-4 py-3.5 text-left transition hover:bg-white/60 sm:border-l sm:border-black/5 sm:px-5 sm:py-4"
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                <CalendarDays className="h-3.5 w-3.5" /> {t.search.dates}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[15px] font-medium text-foreground">
                <span
                  className={cn(
                    "truncate",
                    !dateArrivee && !dateDepart && "text-foreground/40"
                  )}
                >
                  {formatDatesLabel(dateArrivee, dateDepart, language, t.search.datesPlaceholder)}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-foreground/40" />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto rounded-2xl border-black/5 p-0 shadow-float"
          >
            <Calendar
              mode="range"
              numberOfMonths={1}
              locale={calendarLocale}
              selected={dateRange}
              defaultMonth={dateRange?.from || new Date()}
              disabled={{ before: startOfLocalToday() }}
              onSelect={(range) => {
                setSearchError("");
                if (!range?.from) {
                  setDateArrivee("");
                  setDateDepart("");
                  return;
                }

                const fromIso = toIsoDate(range.from);
                const toIso = toIsoDate(range.to);
                // react-day-picker sets from === to on the first click; keep only arrival then.
                const sameDay = Boolean(fromIso && toIso && fromIso === toIso);

                if (!toIso || sameDay) {
                  setDateArrivee(fromIso);
                  setDateDepart("");
                  return;
                }

                setDateArrivee(fromIso);
                setDateDepart(toIso);
                setDatesOpen(false);
              }}
              initialFocus
            />
            <div className="flex items-center justify-between border-t border-black/5 px-3 py-2">
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                onClick={() => {
                  setDateArrivee("");
                  setDateDepart("");
                }}
              >
                Effacer
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                style={{ background: "var(--olive-deep)" }}
                onClick={() => setDatesOpen(false)}
              >
                {t.search.validate}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={voyageursOpen} onOpenChange={setVoyageursOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full min-w-0 rounded-2xl px-4 py-3.5 text-left transition hover:bg-white/60 sm:border-l sm:border-black/5 sm:px-5 sm:py-4"
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                <Users className="h-3.5 w-3.5" /> {t.search.travelers}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[15px] font-medium text-foreground">
                <span className="truncate">{formatVoyageursLabel(voyageurs, t.search)}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-foreground/40" />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(100vw-2rem,360px)] rounded-2xl border-black/5 p-4 shadow-float"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{t.search.adults}</p>
                  <p className="text-xs text-muted-foreground">{t.search.adultsHint}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 disabled:opacity-40"
                    disabled={voyageurs.adults <= 1}
                    onClick={() => {
                      setSearchError("");
                      setVoyageurs((current) => ({
                        ...current,
                        adults: Math.max(1, current.adults - 1),
                      }));
                    }}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">{voyageurs.adults}</span>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200"
                    onClick={() =>
                      setVoyageurs((current) => ({
                        ...current,
                        adults: Math.min(12, current.adults + 1),
                      }))
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{t.search.children}</p>
                  <p className="text-xs text-muted-foreground">{t.search.childrenHint}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 disabled:opacity-40"
                    disabled={voyageurs.childrenAges.length <= 0}
                    onClick={() => updateChildrenCount(voyageurs.childrenAges.length - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">
                    {voyageurs.childrenAges.length}
                  </span>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200"
                    onClick={() => updateChildrenCount(voyageurs.childrenAges.length + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {voyageurs.childrenAges.map((age, index) => (
                <div key={`child-${index}`} className="flex items-center justify-between gap-3 pl-1">
                  <span className="text-sm text-muted-foreground">
                    {t.search.childAge} {index + 1}
                  </span>
                  <select
                    value={age < 0 ? "" : age}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const value = raw === "" ? -1 : Number(raw);
                      setSearchError("");
                      setVoyageurs((current) => {
                        const childrenAges = [...current.childrenAges];
                        childrenAges[index] = value;
                        return { ...current, childrenAges };
                      });
                    }}
                    className={cn(
                      "rounded-lg border bg-white px-2 py-1.5 text-sm",
                      age < 0 ? "border-red-300 text-muted-foreground" : "border-slate-200"
                    )}
                  >
                    <option value="">{t.search.chooseAge}</option>
                    {Array.from({ length: 11 }, (_, i) => i + 2).map((option) => (
                      <option key={option} value={option}>
                        {t.search.years(option)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{t.search.babies}</p>
                  <p className="text-xs text-muted-foreground">{t.search.babiesHint}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 disabled:opacity-40"
                    disabled={voyageurs.babiesAges.length <= 0}
                    onClick={() => updateBabiesCount(voyageurs.babiesAges.length - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">
                    {voyageurs.babiesAges.length}
                  </span>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full border border-slate-200"
                    onClick={() => updateBabiesCount(voyageurs.babiesAges.length + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {voyageurs.babiesAges.map((age, index) => (
                <div key={`baby-${index}`} className="flex items-center justify-between gap-3 pl-1">
                  <span className="text-sm text-muted-foreground">
                    {t.search.babyAge} {index + 1}
                  </span>
                  <select
                    value={age < 0 ? "" : age}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const value = raw === "" ? -1 : Number(raw);
                      setSearchError("");
                      setVoyageurs((current) => {
                        const babiesAges = [...current.babiesAges];
                        babiesAges[index] = value;
                        return { ...current, babiesAges };
                      });
                    }}
                    className={cn(
                      "rounded-lg border bg-white px-2 py-1.5 text-sm",
                      age < 0 ? "border-red-300 text-muted-foreground" : "border-slate-200"
                    )}
                  >
                    <option value="">{t.search.chooseAge}</option>
                    <option value={0}>{t.search.underOne}</option>
                    <option value={1}>{t.search.oneYear}</option>
                  </select>
                </div>
              ))}

              <button
                type="button"
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--olive-deep)" }}
                onClick={() => setVoyageursOpen(false)}
              >
                {t.search.validate}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center justify-end p-2 sm:p-1">
          <button
            type="button"
            onClick={handleSearch}
            className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold text-primary-foreground shadow-soft transition hover:shadow-float sm:w-auto"
            style={{ background: "var(--olive-deep)" }}
          >
            <Search className="h-4 w-4" />
            <span>{t.search.search}</span>
          </button>
        </div>
      </div>
      {searchError ? (
        <p className="px-4 pb-2 pt-1 text-left text-sm font-medium text-red-600 sm:px-5">
          {searchError}
        </p>
      ) : null}
    </div>
  );
}

function Hero({
  maisons,
  onSearch,
  onSelectDestination,
}: {
  maisons: MaisonListItem[];
  onSearch: (criteria: SearchCriteria) => void;
  onSelectDestination: (ville: string) => void;
}) {
  const { t } = useLanguage();
  const destinations = useMemo(() => getDestinationCities(maisons), [maisons]);

  return (
    <section className="relative min-h-[100svh] w-full overflow-x-hidden overflow-y-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label={t.hero.heroAlt}
      >
        <source src={heroVideo} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/55" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0.38) 100%)",
        }}
      />

      <Nav destinations={destinations} onSelectDestination={onSelectDestination} />

      <RevealOnScroll
        className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col items-center justify-center px-4 pt-24 pb-16 text-center sm:px-6 sm:pt-28 sm:pb-24 lg:px-10"
        direction="up"
        once
      >
        <h1
          className="max-w-4xl text-balance text-[2rem] leading-[1.08] sm:text-5xl sm:leading-[1.02] lg:text-7xl"
          style={{ color: "var(--cream)" }}
        >
          {t.hero.titleLine1}<br />
          <span className="italic" style={{ color: "var(--terracotta-soft)" }}>{t.hero.titleLine2}</span>
        </h1>
        <p
          className="mt-4 max-w-xl text-balance text-sm sm:mt-6 sm:text-lg"
          style={{ color: "color-mix(in oklab, var(--cream) 85%, transparent)" }}
        >
          {t.hero.subtitle}
        </p>

        <div className="w-full min-w-0">
          <SearchBar maisons={maisons} onSearch={onSearch} />
        </div>
      </RevealOnScroll>
    </section>
  );
}

function SearchFullscreenLoader() {
  const { t, language } = useLanguage();
  const [progress, setProgress] = useState(8);
  const [stageIndex, setStageIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const stages = t.results.loadingStages;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => setVisible(true));

    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 94) {
          return current;
        }
        const step = current < 40 ? 4 : current < 70 ? 3 : 1.5;
        return Math.min(94, current + step);
      });
    }, 90);

    const stageTimer = window.setInterval(() => {
      setStageIndex((current) => Math.min(stages.length - 1, current + 1));
    }, 420);

    return () => {
      document.body.style.overflow = previous;
      window.cancelAnimationFrame(frame);
      window.clearInterval(progressTimer);
      window.clearInterval(stageTimer);
    };
  }, [stages.length]);

  if (typeof document === "undefined") {
    return null;
  }

  const ringSize = 132;
  const stroke = 3.5;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringOffset = circumference - (progress / 100) * circumference;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden p-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 320ms ease",
      }}
    >
      <div className="absolute inset-0 bg-[rgba(12,10,8,0.72)] backdrop-blur-md" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(196,114,74,0.28), transparent 62%), radial-gradient(ellipse 45% 35% at 85% 80%, rgba(63,91,45,0.22), transparent 55%), radial-gradient(ellipse 40% 30% at 12% 75%, rgba(240,178,122,0.12), transparent 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div
        className="relative z-10 w-full max-w-[420px]"
        style={{
          transform: visible ? "translateY(0) scale(1)" : "translateY(18px) scale(0.98)",
          opacity: visible ? 1 : 0,
          transition: "transform 480ms cubic-bezier(0.22,1,0.36,1), opacity 480ms ease",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[28px] border border-white/15 px-7 py-9 text-center shadow-[0_40px_100px_-36px_rgba(0,0,0,0.85)] sm:px-10 sm:py-11"
          style={{
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 45%, rgba(20,16,12,0.35) 100%)",
            backdropFilter: "blur(22px)",
          }}
        >
          <div
            className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full opacity-50 blur-3xl"
            style={{ background: "rgba(224,160,96,0.35)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-20 -right-10 h-44 w-44 rounded-full opacity-40 blur-3xl"
            style={{ background: "rgba(63,91,45,0.45)" }}
          />

          <div className="relative">
            <img
              src={logo}
              alt="Maroc Résidences"
              className="mx-auto h-12 w-auto max-w-[240px] object-contain drop-shadow-lg sm:h-14"
              style={{ animation: "mr-search-float 3s ease-in-out infinite" }}
            />

            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">
              Maroc Résidences
            </p>

            <div className="relative mx-auto mt-7 grid place-items-center">
              <div
                className="absolute h-36 w-36 rounded-full opacity-40 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(240,178,122,0.45), transparent 70%)",
                  animation: "mr-search-pulse 2.4s ease-in-out infinite",
                }}
              />
              <svg width={ringSize} height={ringSize} className="-rotate-90" aria-hidden>
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={stroke}
                />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  fill="none"
                  stroke="url(#mrSearchRing)"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={ringOffset}
                  style={{ transition: "stroke-dashoffset 180ms linear" }}
                />
                <defs>
                  <linearGradient id="mrSearchRing" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#c45c38" />
                    <stop offset="50%" stopColor="#e0a060" />
                    <stop offset="100%" stopColor="#f5e6c8" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="font-serif text-4xl tabular-nums leading-none text-[#f7efe3] sm:text-5xl">
                    {Math.round(progress)}
                    <span className="ml-0.5 text-lg text-white/45">%</span>
                  </p>
                </div>
              </div>
            </div>

            <h2 className="mt-7 font-serif text-2xl tracking-tight text-[#f7efe3] sm:text-3xl">
              {t.results.loading.replace("…", "").replace("...", "")}
            </h2>
            <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-white/65">
              {t.results.loadingSubtitle}
            </p>

            <div className="mx-auto mt-7 h-1 max-w-[260px] overflow-hidden rounded-full bg-white/12">
              <div
                className="relative h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #b84a2e 0%, #d4924a 55%, #f0d9b0 100%)",
                  boxShadow: "0 0 16px rgba(212,146,74,0.45)",
                  transition: "width 180ms linear",
                }}
              >
                <div
                  className="absolute inset-y-0 w-16"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                    animation: "mr-search-shimmer 1.3s ease-in-out infinite",
                  }}
                />
              </div>
            </div>

            <p
              key={`${language}-${stageIndex}`}
              className="mt-5 min-h-[1.25rem] text-xs font-medium tracking-wide text-[color:var(--terracotta-soft)]"
              style={{ animation: "mr-search-fade-up 380ms ease both" }}
            >
              {stages[stageIndex] || stages[0]}
            </p>

            <div className="mt-6 flex items-center justify-center gap-2">
              {[MapPin, BedDouble, Star].map((Icon, index) => (
                <div
                  key={index}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5"
                  style={{
                    animation: "mr-search-fade-up 500ms ease both",
                    animationDelay: `${index * 120}ms`,
                  }}
                >
                  <Icon className="h-3.5 w-3.5 text-white/70" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] font-medium uppercase tracking-[0.26em] text-white/35">
          Vos vacances au Maroc
        </p>
      </div>

      <style>{`
        @keyframes mr-search-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes mr-search-pulse {
          0%, 100% { opacity: 0.28; transform: scale(0.92); }
          50% { opacity: 0.55; transform: scale(1.08); }
        }
        @keyframes mr-search-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mr-search-shimmer {
          0% { transform: translateX(-140%); }
          100% { transform: translateX(420%); }
        }
      `}</style>
    </div>,
    document.body
  );
}

function SearchLoader() {
  const { t } = useLanguage();

  return (
    <div className="mt-12 overflow-hidden rounded-[32px] border border-black/5 bg-white/80 px-6 py-16 shadow-[0_30px_80px_-48px_rgba(58,52,42,0.55)] sm:px-10">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="relative h-16 w-16">
          <div
            className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin"
            style={{
              borderTopColor: "var(--olive-deep)",
              borderRightColor: "color-mix(in oklab, var(--terracotta) 70%, transparent)",
              animationDuration: "0.9s",
            }}
          />
          <div className="absolute inset-2 rounded-full bg-[#f7f2ea]" />
          <Sparkles
            className="absolute inset-0 m-auto h-5 w-5 animate-pulse"
            style={{ color: "var(--terracotta)" }}
          />
        </div>
        <p className="mt-6 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {t.results.loading}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Nous sélectionnons les maisons d&apos;hôtes qui correspondent à votre séjour.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-3 overflow-hidden rounded-full bg-[#efe8dc]"
              style={{ opacity: 1 - index * 0.18 }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${72 - index * 14}%`,
                  background:
                    "linear-gradient(90deg, var(--olive-deep), color-mix(in oklab, var(--terracotta) 80%, white))",
                  animation: "pulse 1.4s ease-in-out infinite",
                  animationDelay: `${index * 0.15}s`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <div
            key={card}
            className="overflow-hidden rounded-[28px] border border-black/5 bg-white"
          >
            <div className="grid md:grid-cols-[1.1fr_1fr]">
              <div className="min-h-[240px] animate-pulse bg-[#ebe4d8]" />
              <div className="space-y-4 p-6">
                <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#ebe4d8]" />
                <div className="h-3 w-full animate-pulse rounded-full bg-[#f1ebe1]" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-[#f1ebe1]" />
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="h-16 animate-pulse rounded-2xl bg-[#f5f0e7]" />
                  <div className="h-16 animate-pulse rounded-2xl bg-[#f5f0e7]" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchResults({
  criteria,
  results,
  loading,
  onReserve,
}: {
  criteria: SearchCriteria | null;
  results: MaisonListItem[];
  loading: boolean;
  onReserve: (maison: MaisonListItem) => void;
}) {
  const { currency } = useCurrency();
  const { language, t } = useLanguage();
  const [detailsMaison, setDetailsMaison] = useState<DialogMaison | null>(null);

  const handleOpenDetails = async (maison: MaisonListItem) => {
    setDetailsMaison(maison);

    try {
      const context = await fetchPublicBookingContext(maison.id);
      const photos = context.maison.photos || [];

      if (photos.length > 0) {
        setDetailsMaison((current) =>
          current && current.id === maison.id ? { ...current, photos } : current
        );
      }
    } catch {
      // Keep fallback with primary photo only.
    }
  };

  if (!criteria) {
    return null;
  }

  const roomCapacity =
    Number(criteria.voyageurs.adults) > 0
      ? roomTypeCapacity(criteria.voyageurs.adults)
      : 2;
  const roomTypeLabel = t.results.roomType(roomCapacity);
  const childAges =
    criteria.voyageurs.childrenAges.length > 0
      ? ` · ${t.results.childAges}: ${criteria.voyageurs.childrenAges.join(", ")}`
      : "";
  const babyAges =
    criteria.voyageurs.babiesAges.length > 0
      ? ` · ${t.results.babyAges}: ${criteria.voyageurs.babiesAges
          .map((age) => (age === 0 ? t.search.underOne : t.search.years(age)))
          .join(", ")}`
      : "";
  const dateLocale = dateFnsLocale(language);
  const formattedArrivee = criteria.dateArrivee
    ? format(fromIsoDate(criteria.dateArrivee) || new Date(), "d MMM yyyy", { locale: dateLocale })
    : "";
  const formattedDepart = criteria.dateDepart
    ? format(fromIsoDate(criteria.dateDepart) || new Date(), "d MMM yyyy", { locale: dateLocale })
    : "";

  return (
    <section
      id="resultats-recherche"
      className="relative scroll-mt-24 py-12 lg:py-16"
      style={{ background: "linear-gradient(180deg, #f7f1e8 0%, #fbf8f3 45%, #f3eee6 100%)" }}
    >
      <RevealOnScroll className="mx-auto max-w-7xl px-6 lg:px-10" direction="up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--terracotta)" }}
            >
              {t.results.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl">
              {criteria.destination
                ? t.results.titleDestination(criteria.destination)
                : t.results.titleDefault}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatVoyageursLabel(criteria.voyageurs, t.search)}
              {childAges}
              {babyAges}
              {criteria.dateArrivee && criteria.dateDepart
                ? ` · ${t.results.fromTo(formattedArrivee, formattedDepart)}`
                : ""}
            </p>
          </div>
          <div className="rounded-full border border-black/5 bg-white/80 px-4 py-2 text-sm font-medium text-foreground/70 shadow-sm">
            {loading ? t.results.loading : `${results.length}`}
          </div>
        </div>

        {loading ? (
          <SearchLoader />
        ) : results.length === 0 ? (
          <div className="mt-12 rounded-[32px] border border-black/5 bg-white/80 px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-medium">{t.results.empty}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Essayez une autre destination ou réduisez le nombre de voyageurs.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8" id="liste-resultats-recherche">
            {results.map((maison, index) => {
              const photo = resolvePhotoUrl(maison.photo_principale) || house1;
              const location =
                [maison.quartier, maison.ville, maison.pays].filter(Boolean).join(" · ") ||
                "Maroc";
              const rating = Number(maison.note_moyenne);
              const hasRating = Number.isFinite(rating) && rating > 0;
              const amenities = [
                ...(maison.services || []),
                ...(maison.equipements || []),
              ].slice(0, 5);

              return (
                <article
                  key={maison.id}
                  data-search-result-card={index === 0 ? "true" : undefined}
                  className="group relative overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_28px_70px_-40px_rgba(58,52,42,0.55)] transition duration-500 hover:-translate-y-1.5 hover:border-[color-mix(in_oklab,var(--olive)_22%,transparent)] hover:shadow-[0_40px_90px_-42px_rgba(58,52,42,0.72)]"
                  style={{
                    animation: "mr-result-card-in 700ms cubic-bezier(0.22,1,0.36,1) both",
                    animationDelay: `${Math.min(index, 4) * 90}ms`,
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px opacity-0 transition duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, color-mix(in oklab, var(--terracotta) 70%, white), transparent)",
                    }}
                  />

                  <div className="grid lg:grid-cols-[1.08fr_1fr]">
                    <div className="relative min-h-[240px] overflow-hidden sm:min-h-[280px] lg:min-h-full">
                      <img
                        src={photo}
                        alt={maison.nom}
                        className="absolute inset-0 h-full w-full object-cover transition duration-[900ms] ease-out group-hover:scale-[1.08]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5" />
                      <div
                        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition duration-700 group-hover:translate-x-full group-hover:opacity-100"
                        style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
                      />

                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/20">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {t.results.verified}
                        </span>
                        {maison.categorie ? (
                          <span className="inline-flex rounded-full bg-black/35 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
                            {maison.categorie}
                          </span>
                        ) : null}
                      </div>

                      {hasRating ? (
                        <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md ring-1 ring-white/15">
                          <Star
                            className="h-3.5 w-3.5 fill-current"
                            style={{ color: "#f0b27a" }}
                          />
                          {rating.toFixed(1)}
                        </div>
                      ) : null}

                      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                        <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/75 transition duration-500 group-hover:text-white">
                          <MapPin className="h-3.5 w-3.5" />
                          {location}
                        </p>
                        <h3 className="mt-2 max-w-[95%] font-serif text-3xl font-semibold leading-tight tracking-tight transition duration-500 group-hover:translate-x-0.5 sm:text-4xl">
                          {maison.nom}
                        </h3>
                      </div>
                    </div>

                    <div className="relative flex flex-col justify-between p-5 sm:p-7">
                      <div
                        className="pointer-events-none absolute -right-10 top-8 h-28 w-28 rounded-full opacity-0 blur-3xl transition duration-700 group-hover:opacity-100"
                        style={{ background: "color-mix(in oklab, var(--terracotta-soft) 35%, transparent)" }}
                      />

                      <div className="relative">
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {maison.description?.trim() || t.results.defaultDescription}
                        </p>

                        {maison.adresse ? (
                          <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-foreground/55">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--terracotta)]" />
                            <span>
                              {maison.adresse}
                              {maison.ville ? ` · ${maison.ville}` : ""}
                            </span>
                          </p>
                        ) : null}

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-transparent bg-[#f7f2ea] px-3.5 py-3 transition duration-300 group-hover:border-[color-mix(in_oklab,var(--olive)_18%,transparent)] group-hover:bg-[color-mix(in_oklab,var(--olive)_8%,#f7f2ea)]">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/45">
                              <BedDouble className="h-3.5 w-3.5" /> {t.results.rooms}
                            </div>
                            <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "var(--ink)" }}>
                              {maison.nb_chambres || "—"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-transparent bg-[#f7f2ea] px-3.5 py-3 transition duration-300 group-hover:border-[color-mix(in_oklab,var(--terracotta)_20%,transparent)] group-hover:bg-[color-mix(in_oklab,var(--terracotta)_8%,#f7f2ea)]">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/45">
                              <Clock3 className="h-3.5 w-3.5" /> Horaires
                            </div>
                            <p className="mt-1 text-sm font-semibold leading-snug">
                              Check-in {(maison.heure_checkin || "14:00").slice(0, 5)}
                              <br />
                              <span className="text-foreground/50">
                                Check-out {(maison.heure_checkout || "12:00").slice(0, 5)}
                              </span>
                            </p>
                          </div>
                        </div>

                        {amenities.length > 0 ? (
                          <div className="mt-5">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/45">
                              Services & équipements
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {amenities.map((item, amenityIndex) => (
                                <span
                                  key={item}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-[#fbf8f2] px-3 py-1.5 text-xs font-medium text-foreground/75 transition duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--terracotta)_25%,transparent)] hover:bg-white hover:shadow-sm"
                                  style={{
                                    animation: "mr-result-chip-in 500ms ease both",
                                    animationDelay: `${220 + amenityIndex * 60}ms`,
                                  }}
                                >
                                  {/wifi|internet/i.test(item) ? (
                                    <Wifi className="h-3 w-3" />
                                  ) : (
                                    <Sparkles
                                      className="h-3 w-3"
                                      style={{ color: "var(--terracotta)" }}
                                    />
                                  )}
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground/60">
                          {maison.telephone ? (
                            <span className="inline-flex items-center gap-1.5 transition hover:text-foreground">
                              <Phone className="h-3.5 w-3.5" /> {maison.telephone}
                            </span>
                          ) : null}
                          {maison.whatsapp ? (
                            <span className="transition hover:text-foreground">
                              WhatsApp {maison.whatsapp}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="relative mt-5 flex flex-col gap-4 border-t border-black/5 pt-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {t.results.pricingFrom} · {roomTypeLabel}
                          </p>
                          <p
                            className="mt-0.5 text-2xl font-semibold tracking-tight transition duration-300 group-hover:tracking-normal"
                            style={{ color: "var(--ink)" }}
                          >
                            {maison.prix_adulte_min != null &&
                            Number(maison.prix_adulte_min) > 0
                              ? formatMoney(
                                  Number(maison.prix_adulte_min),
                                  currency,
                                  isAppCurrency(maison.devise) ? maison.devise : "MAD"
                                )
                              : currencyLabel(currency)}
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                              {t.results.perNightRoom(roomTypeLabel)}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleOpenDetails(maison)}
                            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:bg-[#f7f2ea] hover:ring-[color-mix(in_oklab,var(--olive)_25%,transparent)]"
                          >
                            {t.results.details}
                          </button>
                          <button
                            type="button"
                            onClick={() => onReserve(maison)}
                            className="group/book inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(63,91,45,0.8)] transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_30px_-12px_rgba(63,91,45,0.9)]"
                            style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                          >
                            {t.results.book}
                            <ArrowUpRight className="h-3.5 w-3.5 transition duration-300 group-hover/book:translate-x-0.5 group-hover/book:-translate-y-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </RevealOnScroll>

      <MaisonDetailsDialog
        maison={detailsMaison}
        onClose={() => setDetailsMaison(null)}
        priceHint={t.results.perNightRoom(roomTypeLabel)}
        primaryLabel={t.results.book}
        onPrimary={(maison) => {
          setDetailsMaison(null);
          onReserve(maison);
        }}
      />

      <style>{`
        @keyframes mr-result-card-in {
          from { opacity: 0; transform: translateY(22px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mr-result-chip-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

function Destinations({
  maisons,
  onSelectDestination,
}: {
  maisons: MaisonListItem[];
  onSelectDestination: (ville: string) => void;
}) {
  const { t } = useLanguage();
  const destinationCards = useMemo(() => buildDestinationCards(maisons), [maisons]);

  return (
    <section id="destinations" className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
      <RevealOnScroll>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--terracotta)" }}>
              {t.destinations.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl sm:text-5xl">{t.destinations.title}</h2>
          </div>
          <a
            href="#maisons"
            className="group inline-flex items-center gap-2 text-sm font-medium text-foreground/70 transition hover:text-foreground"
          >
            {t.destinations.explore}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </a>
        </div>

        {destinationCards.length === 0 ? (
          <p className="mt-12 text-sm text-muted-foreground">
            {t.destinations.empty}
          </p>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {destinationCards.map((d, index) => (
              <RevealItem key={d.name} delay={index * 0.08}>
                <button
                  type="button"
                  onClick={() => onSelectDestination(d.name)}
                  className="group relative block aspect-[3/4] w-full overflow-hidden rounded-3xl text-left shadow-soft transition hover:shadow-float"
                >
                  <img
                    src={d.img}
                    alt={d.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5" style={{ color: "var(--cream)" }}>
                    <div className="text-xs uppercase tracking-[0.18em] opacity-80">
                      {d.count > 1 ? t.destinations.guestHouses : t.destinations.guestHouse}
                    </div>
                    <div className="mt-1 flex items-end justify-between gap-3">
                      <h3 className="text-2xl" style={{ color: "var(--cream)" }}>
                        {d.name}
                      </h3>
                      <span
                        className="glass shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {t.destinations.count(d.count)}
                      </span>
                    </div>
                  </div>
                </button>
              </RevealItem>
            ))}
          </div>
        )}
      </RevealOnScroll>
    </section>
  );
}

function Houses({
  maisons,
  onSelectDestination,
}: {
  maisons: MaisonListItem[];
  onSelectDestination: (ville: string) => void;
}) {
  const { currency } = useCurrency();
  const { t } = useLanguage();
  const featured = maisons.slice(0, 6);
  const [detailsMaison, setDetailsMaison] = useState<DialogMaison | null>(null);

  const handleOpenDetails = async (maison: MaisonListItem) => {
    setDetailsMaison(maison);

    try {
      const context = await fetchPublicBookingContext(maison.id);
      const photos = context.maison.photos || [];

      if (photos.length > 0) {
        setDetailsMaison((current) =>
          current && current.id === maison.id ? { ...current, photos } : current
        );
      }
    } catch {
      // Keep fallback with primary photo only.
    }
  };

  return (
    <section id="maisons" className="relative py-24 lg:py-32" style={{ background: "color-mix(in oklab, var(--sand) 55%, var(--cream))" }}>
      <RevealOnScroll className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--olive-deep)" }}>
              {t.houses.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl sm:text-5xl">{t.houses.title}</h2>
          </div>
          <a href="#destinations" className="group inline-flex items-center gap-2 text-sm font-medium text-foreground/70 transition hover:text-foreground">
            {t.houses.seeAll}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </a>
        </div>

        {featured.length === 0 ? (
          <p className="mt-12 text-sm text-muted-foreground">
            {t.houses.empty}
          </p>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((maison, index) => {
              const photo = resolvePhotoUrl(maison.photo_principale) || house1;
              const location =
                [maison.quartier, maison.ville].filter(Boolean).join(", ") || "Maroc";
              const rating = Number(maison.note_moyenne);
              const hasRating = Number.isFinite(rating) && rating > 0;
              const fromDevise = isAppCurrency(maison.devise) ? maison.devise : "MAD";

              return (
                <RevealItem key={maison.id} delay={index * 0.07}>
                  <article className="card-float group overflow-hidden hover:-translate-y-1.5">
                    <div className="relative aspect-[5/4] overflow-hidden rounded-t-3xl">
                      <img
                        src={photo}
                        alt={maison.nom}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                      {maison.categorie ? (
                        <span
                          className="glass absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold"
                          style={{ color: "var(--ink)" }}
                        >
                          {maison.categorie}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-xl">{maison.nom}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{location}</p>
                        </div>
                        {hasRating ? (
                          <div className="flex shrink-0 items-center gap-1 text-sm font-medium">
                            <Star className="h-4 w-4 fill-current" style={{ color: "var(--terracotta)" }} />
                            {rating.toFixed(1)}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-5 flex items-end justify-between gap-3">
                        <div>
                          {maison.prix_adulte_min != null &&
                          Number(maison.prix_adulte_min) > 0 ? (
                            <>
                              <span className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                                {formatMoney(
                                  Number(maison.prix_adulte_min),
                                  currency,
                                  fromDevise
                                )}
                              </span>
                              <span className="ml-1 text-sm text-muted-foreground">
                                {t.houses.perNightAdult}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {t.houses.onRequest(currencyLabel(currency))}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleOpenDetails(maison)}
                          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition"
                          style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                        >
                          {t.houses.view} <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                </RevealItem>
              );
            })}
          </div>
        )}
      </RevealOnScroll>

      <MaisonDetailsDialog
        maison={detailsMaison}
        onClose={() => setDetailsMaison(null)}
        priceHint={t.houses.perNightAdult}
        primaryLabel={t.houses.seeAvailabilities}
        onPrimary={(maison) => {
          setDetailsMaison(null);
          const ville = maison.ville?.trim();

          if (ville) {
            onSelectDestination(ville);
          }
        }}
      />
    </section>
  );
}

function Advantages() {
  const { t } = useLanguage();

  return (
    <section id="experiences" className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
      <RevealOnScroll>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--terracotta)" }}>
            {t.advantages.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl">{t.advantages.title}</h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {t.advantages.items.map(({ title, desc }, index) => {
            const Icon = advantageIcons[index] ?? ShieldCheck;

            return (
              <RevealItem key={title} delay={index * 0.1}>
                <div className="card-float h-full p-8">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-2xl"
                    style={{ background: "color-mix(in oklab, var(--olive) 15%, white)", color: "var(--olive-deep)" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-2xl">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </RevealItem>
            );
          })}
        </div>
      </RevealOnScroll>
    </section>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  const stepIcons = [Search, BedDouble, CheckCircle2] as const;

  return (
    <section
      id="comment-reserver"
      className="relative overflow-hidden py-24 lg:py-32"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--sand) 55%, var(--cream)) 0%, var(--cream) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 50% 40% at 10% 20%, color-mix(in oklab, var(--olive) 12%, transparent), transparent 60%), radial-gradient(ellipse 45% 35% at 90% 80%, color-mix(in oklab, var(--terracotta) 10%, transparent), transparent 55%)",
        }}
      />

      <RevealOnScroll className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--terracotta)" }}
          >
            {t.howItWorks.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl">{t.howItWorks.title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t.howItWorks.subtitle}
          </p>
        </div>

        <div className="relative mt-14 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          <div
            className="pointer-events-none absolute left-[16%] right-[16%] top-[2.75rem] hidden h-px md:block"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in oklab, var(--olive) 35%, transparent), transparent)",
            }}
          />

          {t.howItWorks.steps.map((step, index) => {
            const Icon = stepIcons[index] ?? Search;

            return (
              <RevealItem key={step.title} delay={index * 0.12}>
                <div className="group relative text-center md:px-4">
                  <div className="relative mx-auto grid h-14 w-14 place-items-center">
                    <div
                      className="absolute inset-0 rounded-full opacity-40 blur-xl transition duration-500 group-hover:opacity-70"
                      style={{ background: "color-mix(in oklab, var(--terracotta-soft) 50%, transparent)" }}
                    />
                    <div
                      className="relative grid h-14 w-14 place-items-center rounded-full text-sm font-semibold shadow-soft ring-4 ring-white transition duration-500 group-hover:-translate-y-1"
                      style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  </div>

                  <div
                    className="mx-auto mt-5 grid h-11 w-11 place-items-center rounded-2xl transition duration-300 group-hover:scale-105"
                    style={{
                      background: "color-mix(in oklab, var(--olive) 12%, white)",
                      color: "var(--olive-deep)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-5 text-xl sm:text-2xl">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </RevealItem>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center">
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:brightness-110"
            style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
          >
            {t.howItWorks.cta}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </RevealOnScroll>
    </section>
  );
}

function PracticalInfo() {
  const { t } = useLanguage();
  const icons = [CreditCard, Clock3, KeyRound, Headphones] as const;

  return (
    <section id="infos-pratiques" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 lg:px-10 lg:py-32">
      <RevealOnScroll>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <RevealItem direction="left">
            <div className="max-w-xl">
              <p
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--terracotta)" }}
              >
                {t.practical.eyebrow}
              </p>
              <h2 className="mt-3 text-4xl sm:text-5xl">{t.practical.title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.practical.subtitle}
              </p>
              <a
                href="#faq"
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground/70 transition hover:text-foreground"
              >
                {t.practical.faqLink}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </RevealItem>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {t.practical.items.map((item, index) => {
              const Icon = icons[index] ?? ShieldCheck;

              return (
                <RevealItem key={item.title} delay={0.08 + index * 0.08} direction="right">
                  <div className="group h-full rounded-[24px] border border-black/5 bg-white p-6 shadow-[0_20px_50px_-40px_rgba(58,52,42,0.55)] transition duration-400 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--olive)_20%,transparent)] hover:shadow-[0_28px_60px_-38px_rgba(58,52,42,0.65)]">
                    <div
                      className="grid h-11 w-11 place-items-center rounded-2xl transition duration-300 group-hover:scale-105"
                      style={{
                        background: "color-mix(in oklab, var(--olive) 12%, white)",
                        color: "var(--olive-deep)",
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-xl">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </RevealItem>
              );
            })}
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

function Testimonials() {
  const { t } = useLanguage();
  const [avis, setAvis] = useState<PublishedAvis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await fetchPublishedAvis();
        if (!cancelled) {
          setAvis(data);
        }
      } catch {
        if (!cancelled) {
          setAvis([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && avis.length === 0) {
    return (
      <section
        id="avis"
        className="relative scroll-mt-24 py-24 lg:py-32"
        style={{ background: "var(--ink)" }}
      >
        <RevealOnScroll className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--terracotta-soft)" }}
            >
              {t.testimonials.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl sm:text-5xl" style={{ color: "var(--cream)" }}>
              {t.testimonials.title}
            </h2>
            <p
              className="mt-6 text-sm"
              style={{ color: "color-mix(in oklab, var(--cream) 55%, transparent)" }}
            >
              {t.testimonials.empty}
            </p>
          </div>
        </RevealOnScroll>
      </section>
    );
  }

  return (
    <section
      id="avis"
      className="relative scroll-mt-24 py-24 lg:py-32"
      style={{ background: "var(--ink)" }}
    >
      <RevealOnScroll className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--terracotta-soft)" }}
          >
            {t.testimonials.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl" style={{ color: "var(--cream)" }}>
            {t.testimonials.title}
          </h2>
        </div>

        {loading ? (
          <p
            className="mt-14 text-center text-sm"
            style={{ color: "color-mix(in oklab, var(--cream) 55%, transparent)" }}
          >
            …
          </p>
        ) : (
          <Carousel
            opts={{ align: "start", loop: avis.length > 3 }}
            className="mt-14 w-full"
          >
            <CarouselContent className="-ml-4">
              {avis.map((item) => {
                const location =
                  [item.maison_nom, item.maison_ville].filter(Boolean).join(" · ") ||
                  t.testimonials.guestFallback;

                return (
                  <CarouselItem
                    key={item.id}
                    className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3"
                  >
                    <figure
                      className="h-full rounded-3xl p-8"
                      style={{
                        background: "color-mix(in oklab, white 6%, transparent)",
                        border: "1px solid color-mix(in oklab, white 12%, transparent)",
                        backdropFilter: "blur(20px)",
                      }}
                    >
                      <div className="flex gap-0.5" style={{ color: "var(--terracotta-soft)" }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn("h-4 w-4", i < item.note ? "fill-current" : "")}
                          />
                        ))}
                      </div>
                      {item.titre ? (
                        <p
                          className="mt-4 text-sm font-semibold"
                          style={{ color: "var(--cream)" }}
                        >
                          {item.titre}
                        </p>
                      ) : null}
                      <blockquote
                        className="mt-3 font-display text-lg leading-relaxed"
                        style={{ color: "var(--cream)" }}
                      >
                        « {item.commentaire} »
                      </blockquote>
                      <figcaption
                        className="mt-6 text-sm"
                        style={{
                          color: "color-mix(in oklab, var(--cream) 70%, transparent)",
                        }}
                      >
                        <div className="font-medium" style={{ color: "var(--cream)" }}>
                          {item.nom}
                        </div>
                        <div>{location}</div>
                      </figcaption>
                    </figure>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            {avis.length > 1 ? (
              <>
                <CarouselPrevious
                  className="left-0 border-white/20 bg-white/10 text-[var(--cream)] hover:bg-white/20 hover:text-[var(--cream)] disabled:opacity-30 md:-left-4"
                />
                <CarouselNext
                  className="right-0 border-white/20 bg-white/10 text-[var(--cream)] hover:bg-white/20 hover:text-[var(--cream)] disabled:opacity-30 md:-right-4"
                />
              </>
            ) : null}
          </Carousel>
        )}
      </RevealOnScroll>
    </section>
  );
}

function AvisForm({ maisons }: { maisons: MaisonListItem[] }) {
  const { t } = useLanguage();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [maisonId, setMaisonId] = useState("");
  const [note, setNote] = useState(5);
  const [hoverNote, setHoverNote] = useState(0);
  const [titre, setTitre] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!nom.trim() || !email.trim() || !commentaire.trim() || !maisonId) {
      setError(t.avis.errorRequired);
      return;
    }

    if (commentaire.trim().length < 20) {
      setError(t.avis.errorLength);
      return;
    }

    setSubmitting(true);

    try {
      await createPublicAvis({
        maison_id: Number(maisonId),
        nom: nom.trim(),
        email: email.trim(),
        note,
        titre: titre.trim() || null,
        commentaire: commentaire.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible d'envoyer l'avis."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNom("");
    setEmail("");
    setMaisonId("");
    setNote(5);
    setTitre("");
    setCommentaire("");
    setSubmitted(false);
    setSubmitting(false);
    setError("");
  };

  const displayNote = hoverNote || note;

  return (
    <section
      id="deposer-avis"
      className="relative scroll-mt-24 py-24 lg:py-32"
      style={{ background: "linear-gradient(180deg, #fbf8f3 0%, #f3eee6 100%)" }}
    >
      <RevealOnScroll className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="max-w-xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--terracotta)" }}
            >
              {t.avis.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl sm:text-5xl">{t.avis.title}</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t.avis.subtitle}
            </p>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_28px_70px_-48px_rgba(58,52,42,0.55)] sm:p-8">
            {submitted ? (
              <div className="py-6 text-center">
                <div
                  className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in oklab, var(--olive-deep) 12%, white)" }}
                >
                  <CheckCircle2 className="h-7 w-7" style={{ color: "var(--olive-deep)" }} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                  {t.avis.thanksTitle}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.avis.thanksBody}
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className="mt-6 rounded-full px-5 py-2.5 text-sm font-semibold transition"
                  style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                >
                  {t.avis.another}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">{t.avis.name}</span>
                    <input
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                      placeholder={t.avis.namePlaceholder}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">{t.avis.email}</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="vous@exemple.com"
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                </div>

                <label className="block space-y-2 text-sm">
                  <span className="font-medium">{t.avis.maison}</span>
                  <select
                    value={maisonId}
                    onChange={(e) => setMaisonId(e.target.value)}
                    required
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{t.avis.maisonPlaceholder}</option>
                    {maisons.map((maison) => (
                      <option key={maison.id} value={String(maison.id)}>
                        {maison.nom}
                        {maison.ville ? ` — ${maison.ville}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2 text-sm">
                  <span className="font-medium">{t.avis.rating}</span>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const value = index + 1;
                      const active = value <= displayNote;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setNote(value)}
                          onMouseEnter={() => setHoverNote(value)}
                          onMouseLeave={() => setHoverNote(0)}
                          className="rounded-md p-1 transition hover:scale-110"
                          aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
                        >
                          <Star
                            className={cn("h-7 w-7", active ? "fill-current" : "")}
                            style={{
                              color: active ? "var(--terracotta)" : "color-mix(in oklab, var(--ink) 25%, transparent)",
                            }}
                          />
                        </button>
                      );
                    })}
                    <span className="ml-2 text-sm text-muted-foreground">
                      {note}/5
                    </span>
                  </div>
                </div>

                <label className="block space-y-2 text-sm">
                  <span className="font-medium">{t.avis.titleOptional}</span>
                  <input
                    value={titre}
                    onChange={(e) => setTitre(e.target.value)}
                    placeholder={t.avis.titlePlaceholder}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  />
                </label>

                <label className="block space-y-2 text-sm">
                  <span className="font-medium">{t.avis.comment}</span>
                  <textarea
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    required
                    rows={5}
                    placeholder={t.avis.commentPlaceholder}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                {error ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full rounded-full text-sm font-semibold transition disabled:opacity-60"
                  style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                >
                  {submitting ? t.avis.submitting : t.avis.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

function FaqSection() {
  const { t } = useLanguage();

  return (
    <section id="faq" className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 lg:px-10 lg:py-32">
      <RevealOnScroll>
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--terracotta)" }}
          >
            {t.faq.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl">{t.faq.title}</h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {t.faq.subtitle}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-[28px] border border-black/5 bg-white px-5 py-2 shadow-[0_28px_70px_-48px_rgba(58,52,42,0.45)] sm:px-8">
          <Accordion type="single" collapsible className="w-full">
            {t.faq.items.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={`faq-${index}`}
                className="border-black/5"
              >
                <AccordionTrigger
                  className="py-5 text-base font-semibold hover:no-underline"
                  style={{ color: "var(--ink)" }}
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </RevealOnScroll>
    </section>
  );
}

function CTA() {
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
      <RevealOnScroll>
        <div
          className="relative overflow-hidden rounded-4xl px-8 py-20 text-center sm:px-16"
          style={{
            background:
              "linear-gradient(135deg, var(--terracotta) 0%, oklch(0.55 0.12 38) 60%, var(--olive-deep) 130%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(1200px 400px at 20% 0%, white, transparent 60%), radial-gradient(800px 300px at 80% 100%, white, transparent 60%)",
            }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-4xl sm:text-6xl" style={{ color: "var(--cream)" }}>
              {t.cta.title}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg" style={{ color: "color-mix(in oklab, var(--cream) 88%, transparent)" }}>
              {t.cta.subtitle}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-semibold shadow-float transition hover:-translate-y-0.5"
                style={{ background: "var(--cream)", color: "var(--ink)" }}
              >
                {t.cta.button} <ArrowRight className="h-4 w-4" />
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-medium ring-1 transition hover:bg-white/10"
                style={{ color: "var(--cream)", borderColor: "color-mix(in oklab, white 40%, transparent)" }}
              >
                {t.cta.concierge}
              </button>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();

  const footerColumns = [
    {
      title: t.footer.explorer,
      items: [
        { label: t.footer.explorerItems[0], href: "#destinations" },
        { label: t.footer.explorerItems[1], href: "#maisons" },
        { label: t.footer.explorerItems[2], href: "#experiences" },
        { label: t.footer.explorerItems[3], href: "#avis" },
      ],
    },
    {
      title: t.footer.hosts,
      items: t.footer.hostsItems.map((label) => ({ label, href: "#contact" })),
    },
    {
      title: t.footer.about,
      items: [
        { label: t.footer.aboutItems[0], href: "#experiences" },
        { label: t.footer.aboutItems[1], href: "#avis" },
        { label: t.footer.aboutItems[2], href: "#contact" },
        { label: t.footer.aboutItems[3], href: "#faq" },
      ],
    },
  ] as const;

  return (
    <footer
      id="contact"
      className="relative overflow-hidden border-t border-border/70"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--sand) 45%, var(--cream)) 0%, var(--cream) 100%)",
        color: "var(--ink)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 0%, color-mix(in oklab, var(--olive) 12%, transparent), transparent 45%), radial-gradient(circle at 90% 100%, color-mix(in oklab, var(--terracotta) 10%, transparent), transparent 40%)",
        }}
      />

      <RevealOnScroll className="relative mx-auto max-w-7xl px-6 pb-10 pt-16 lg:px-10 lg:pb-12 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
          <div className="max-w-md">
            <a href="#" className="inline-block">
              <img
                src={logo}
                alt="Maroc Résidences"
                className="h-14 w-auto max-w-[280px] object-contain sm:h-16 sm:max-w-[320px]"
              />
            </a>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {t.footer.tagline}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#maisons"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-110"
                style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
              >
                {t.houses.seeAll}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="mailto:contact@marocresidences.com"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-[color-mix(in_oklab,var(--olive)_35%,var(--border))] hover:text-foreground"
              >
                <Phone className="h-3.5 w-3.5" />
                {t.footer.aboutItems[2]}
              </a>
            </div>
          </div>

          {footerColumns.map((col) => (
            <div key={col.title}>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--olive-deep)" }}
              >
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Maroc Résidences — {t.footer.rights}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <a href="#" className="transition hover:text-foreground">
              {t.footer.privacy}
            </a>
            <a href="#" className="transition hover:text-foreground">
              {t.footer.terms}
            </a>
            <a href="#" className="transition hover:text-foreground">
              {t.footer.cookies}
            </a>
          </div>
        </div>
      </RevealOnScroll>
    </footer>
  );
}

function BookingAuthDialog({
  open,
  onOpenChange,
  onAuthSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess: () => void | Promise<void>;
}) {
  const { t } = useLanguage();

  return (
    <AuthDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultTab="register"
      message={t.authBooking}
      onAuthSuccess={onAuthSuccess}
    />
  );
}

function Landing() {
  const navigate = useNavigate();
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [results, setResults] = useState<MaisonListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [bookingAuthOpen, setBookingAuthOpen] = useState(false);
  const pendingBookingRef = useRef<{
    maisonId: string;
    search: {
      arrivee: string;
      depart: string;
      adults: number;
      enfants: string;
      bebes: string;
    };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchMaisonsCatalog()
      .then((data) => {
        if (!cancelled) {
          setMaisons(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaisons([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const goToBooking = (maisonId: string, searchCriteria: SearchCriteria) => {
    void navigate({
      to: "/reserver/$maisonId",
      params: { maisonId },
      search: {
        arrivee: searchCriteria.dateArrivee,
        depart: searchCriteria.dateDepart,
        adults: searchCriteria.voyageurs.adults,
        enfants: searchCriteria.voyageurs.childrenAges.join(","),
        bebes: searchCriteria.voyageurs.babiesAges.join(","),
      },
    });
  };

  const handleReserve = (maison: MaisonListItem) => {
    if (!criteria) {
      return;
    }

    const bookingSearch = {
      arrivee: criteria.dateArrivee,
      depart: criteria.dateDepart,
      adults: criteria.voyageurs.adults,
      enfants: criteria.voyageurs.childrenAges.join(","),
      bebes: criteria.voyageurs.babiesAges.join(","),
    };

    if (getAuthToken()) {
      goToBooking(String(maison.id), criteria);
      return;
    }

    pendingBookingRef.current = {
      maisonId: String(maison.id),
      search: bookingSearch,
    };
    setBookingAuthOpen(true);
  };

  const handleBookingAuthSuccess = async () => {
    const pending = pendingBookingRef.current;
    pendingBookingRef.current = null;

    if (!pending) {
      return;
    }

    await navigate({
      to: "/reserver/$maisonId",
      params: { maisonId: pending.maisonId },
      search: pending.search,
    });
  };

  const handleSearch = async (
    next: SearchCriteria,
    options?: { browseDestination?: boolean }
  ) => {
    setCriteria(next);
    setSearching(true);
    setResults([]);

    const startedAt = Date.now();
    const MIN_LOADER_MS = 1800;

    try {
      const catalog = await fetchMaisonsCatalog(next.destination || undefined, {
        adults: options?.browseDestination ? undefined : next.voyageurs.adults,
      });

      const query = next.destination.trim().toLowerCase();

      const filtered = !query
        ? catalog
        : catalog.filter((maison) => {
            const ville = (maison.ville || "").trim().toLowerCase();

            if (options?.browseDestination) {
              return (
                ville === query ||
                ville.includes(query) ||
                query.includes(ville)
              );
            }

            const haystack = [
              maison.nom,
              maison.ville,
              maison.quartier,
              maison.adresse,
              maison.categorie,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return haystack.includes(query);
          });

      setResults(filtered);
    } catch {
      setResults([]);
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_LOADER_MS - elapsed);

      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }

      setSearching(false);

      window.setTimeout(() => {
        const headerOffset = 96;
        const firstCard = document.querySelector<HTMLElement>(
          "[data-search-result-card='true']"
        );
        const section = document.getElementById("resultats-recherche");
        const target = firstCard || section;

        if (!target) {
          return;
        }

        const rect = target.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top;
        const viewHeight = window.innerHeight;
        const available = viewHeight - headerOffset - 24;
        let nextTop: number;

        if (firstCard && rect.height <= available) {
          // Center the full card in the visible area under the fixed nav
          nextTop =
            absoluteTop - headerOffset - Math.max(0, (available - rect.height) / 2);
        } else {
          // Card taller than viewport: pin its top just under the nav
          nextTop = absoluteTop - headerOffset - 12;
        }

        window.scrollTo({
          top: Math.max(0, nextTop),
          behavior: "smooth",
        });
      }, 80);
    }
  };

  const handleSelectDestination = (ville: string) => {
    void handleSearch(
      {
        destination: ville,
        dateArrivee: criteria?.dateArrivee || "",
        dateDepart: criteria?.dateDepart || "",
        voyageurs: criteria?.voyageurs || {
          adults: 2,
          childrenAges: [],
          babiesAges: [],
        },
      },
      { browseDestination: true }
    );
  };

  return (
    <CurrencyProvider>
      <LanguageProvider>
        <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
          {searching ? <SearchFullscreenLoader /> : null}
          <Hero
            maisons={maisons}
            onSearch={handleSearch}
            onSelectDestination={handleSelectDestination}
          />
          <SearchResults
            criteria={criteria}
            results={results}
            loading={searching}
            onReserve={handleReserve}
          />
          <Destinations maisons={maisons} onSelectDestination={handleSelectDestination} />
          <Houses maisons={maisons} onSelectDestination={handleSelectDestination} />
          <Advantages />
          <HowItWorks />
          <Testimonials />
          <AvisForm maisons={maisons} />
          <PracticalInfo />
          <FaqSection />
          <CTA />
          <Footer />
          <HomeFloatingWidgets />
          <BookingAuthDialog
            open={bookingAuthOpen}
            onOpenChange={(open) => {
              setBookingAuthOpen(open);
              if (!open) {
                pendingBookingRef.current = null;
              }
            }}
            onAuthSuccess={handleBookingAuthSuccess}
          />
        </main>
      </LanguageProvider>
    </CurrencyProvider>
  );
}
