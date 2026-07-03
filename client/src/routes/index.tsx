import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  ChevronDown,
} from "lucide-react";

import logo from "@/assets/logo.jpg";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import heroRiad from "@/assets/hero-riad.jpg";
import destMarrakech from "@/assets/dest-marrakech.jpg";
import destChefchaouen from "@/assets/dest-chefchaouen.jpg";
import destEssaouira from "@/assets/dest-essaouira.jpg";
import destMerzouga from "@/assets/dest-merzouga.jpg";
import house1 from "@/assets/house-1.jpg";
import house2 from "@/assets/house-2.jpg";
import house3 from "@/assets/house-3.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { property: "og:image", content: logo },
    ],
  }),
});

const destinations = [
  { name: "Marrakech", tag: "La ville ocre", count: "428 maisons", img: destMarrakech },
  { name: "Chefchaouen", tag: "La perle bleue", count: "112 maisons", img: destChefchaouen },
  { name: "Essaouira", tag: "Souffle de l'Atlantique", count: "186 maisons", img: destEssaouira },
  { name: "Merzouga", tag: "Dunes du Sahara", count: "74 campements", img: destMerzouga },
];

const navDestinations = [
  "Marrakech",
  "Essaouira",
  "Tanger",
  "Chefchaouen",
  "M'hamid",
  "Vallée du Dadès",
];

const houses = [
  {
    img: house1,
    name: "Riad El Andalous",
    location: "Médina, Marrakech",
    price: 189,
    rating: 4.96,
    reviews: 214,
    tag: "Coup de cœur",
  },
  {
    img: house2,
    name: "Dar Atlas Retreat",
    location: "Vallée de l'Ourika",
    price: 245,
    rating: 4.92,
    reviews: 138,
    tag: "Vue montagne",
  },
  {
    img: house3,
    name: "Riad Zellige",
    location: "Fès el-Bali",
    price: 156,
    rating: 4.89,
    reviews: 302,
    tag: "Patio historique",
  },
];

const testimonials = [
  {
    quote: "Un séjour d'une élégance rare. Chaque détail avait été pensé, du thé à la menthe à l'accueil du gardien.",
    name: "Camille Laurent",
    role: "Paris, France",
  },
  {
    quote: "La plateforme la plus fluide que j'ai utilisée pour un voyage. Les maisons sont réellement à la hauteur des photos.",
    name: "Youssef Amrani",
    role: "Casablanca, Maroc",
  },
  {
    quote: "Support impeccable, réservation en trois clics. Nous reviendrons chaque année pour découvrir un nouveau riad.",
    name: "Sofia & Marco",
    role: "Milan, Italie",
  },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled
          ? "bg-white/80 shadow-md backdrop-blur-md"
          : "bg-white",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <a href="#" className="flex items-center">
          <img src={logo} alt="Maroc Résidences" className="h-10 w-auto object-contain" />
        </a>
        <nav className="hidden items-center gap-8 text-sm text-foreground/80 md:flex">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="inline-flex shrink-0 items-center gap-1 opacity-80 outline-none transition-opacity hover:opacity-100 data-[state=open]:opacity-100">
              Destinations
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {navDestinations.map((city) => (
                <DropdownMenuItem key={city} asChild>
                  <a href="#destinations">{city}</a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <a href="#maisons" className="opacity-80 transition hover:opacity-100">Maisons</a>
          <a href="#experiences" className="opacity-80 transition hover:opacity-100">Expériences</a>
          <a href="#contact" className="opacity-80 transition hover:opacity-100">Aide</a>
        </nav>
        <div className="flex items-center gap-3">
          <button className="hidden text-sm text-foreground/80 transition hover:text-foreground sm:block">
            Se connecter
          </button>
          <button className="rounded-full px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-muted">
            Devenir hôte
          </button>
        </div>
      </div>
    </header>
  );
}

function SearchBar() {
  const [dest, setDest] = useState("");
  return (
    <div className="glass mx-auto mt-10 w-full max-w-5xl rounded-3xl p-2 sm:mt-14 sm:rounded-4xl sm:p-3">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
        <label className="group rounded-2xl px-5 py-4 transition hover:bg-white/60">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
            <MapPin className="h-3.5 w-3.5" /> Destination
          </div>
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="Marrakech, Chefchaouen…"
            className="mt-1 w-full bg-transparent text-[15px] font-medium text-foreground placeholder:text-foreground/40 focus:outline-none"
          />
        </label>
        <label className="rounded-2xl px-5 py-4 transition hover:bg-white/60 sm:border-l sm:border-black/5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
            <CalendarDays className="h-3.5 w-3.5" /> Dates
          </div>
          <input
            placeholder="Arrivée — Départ"
            className="mt-1 w-full bg-transparent text-[15px] font-medium text-foreground placeholder:text-foreground/40 focus:outline-none"
          />
        </label>
        <label className="rounded-2xl px-5 py-4 transition hover:bg-white/60 sm:border-l sm:border-black/5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
            <Users className="h-3.5 w-3.5" /> Voyageurs
          </div>
          <input
            placeholder="2 adultes"
            className="mt-1 w-full bg-transparent text-[15px] font-medium text-foreground placeholder:text-foreground/40 focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-end p-2 sm:p-1">
          <button
            className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold text-primary-foreground shadow-soft transition hover:shadow-float sm:w-auto"
            style={{ background: "var(--olive-deep)" }}
          >
            <Search className="h-4 w-4" />
            <span>Rechercher</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden">
      <img
        src={heroRiad}
        alt="Riad marocain au coucher du soleil"
        width={1920}
        height={1280}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/70" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 20%, color-mix(in oklab, black 15%, transparent), transparent 70%)",
        }}
      />

      <Nav />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col items-center justify-center px-6 pt-28 pb-24 text-center lg:px-10">
        <div
          className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
          style={{ color: "var(--ink)" }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--terracotta)" }} />
          Nouveau — Sélection curatée pour l'automne
        </div>
        <h1
          className="mt-6 max-w-4xl text-balance text-5xl leading-[1.02] sm:text-6xl lg:text-7xl"
          style={{ color: "var(--cream)" }}
        >
          L'art de séjourner<br />
          <span className="italic" style={{ color: "var(--terracotta-soft)" }}>au Maroc.</span>
        </h1>
        <p
          className="mt-6 max-w-xl text-balance text-base sm:text-lg"
          style={{ color: "color-mix(in oklab, var(--cream) 85%, transparent)" }}
        >
          Des riads et maisons d'hôtes vérifiés, choisis un à un pour vous offrir
          une hospitalité qui ne s'oublie pas.
        </p>

        <SearchBar />

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs" style={{ color: "color-mix(in oklab, var(--cream) 75%, transparent)" }}>
          <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> +1 200 maisons vérifiées</span>
          <span className="inline-flex items-center gap-2"><Star className="h-4 w-4" /> 4,92 / 5 en moyenne</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Paiement sécurisé</span>
        </div>
      </div>
    </section>
  );
}

function Destinations() {
  return (
    <section id="destinations" className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--terracotta)" }}>
            Destinations populaires
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl">Là où le Maroc vous appelle.</h2>
        </div>
        <a href="#" className="group inline-flex items-center gap-2 text-sm font-medium text-foreground/70 transition hover:text-foreground">
          Explorer toutes les destinations
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </a>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {destinations.map((d) => (
          <a
            key={d.name}
            href="#"
            className="group relative block aspect-[3/4] overflow-hidden rounded-3xl shadow-soft transition hover:shadow-float"
          >
            <img
              src={d.img}
              alt={d.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5" style={{ color: "var(--cream)" }}>
              <div className="text-xs uppercase tracking-[0.18em] opacity-80">{d.tag}</div>
              <div className="mt-1 flex items-end justify-between">
                <h3 className="text-2xl" style={{ color: "var(--cream)" }}>{d.name}</h3>
                <span className="glass rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ color: "var(--ink)" }}>
                  {d.count}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Houses() {
  return (
    <section id="maisons" className="relative py-24 lg:py-32" style={{ background: "color-mix(in oklab, var(--sand) 55%, var(--cream))" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--olive-deep)" }}>
              Maisons d'hôtes recommandées
            </p>
            <h2 className="mt-3 text-4xl sm:text-5xl">Un art de vivre, choisi avec soin.</h2>
          </div>
          <a href="#" className="group inline-flex items-center gap-2 text-sm font-medium text-foreground/70 transition hover:text-foreground">
            Voir toutes les maisons
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </a>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {houses.map((h) => (
            <article
              key={h.name}
              className="card-float group overflow-hidden hover:-translate-y-1.5"
            >
              <div className="relative aspect-[5/4] overflow-hidden rounded-t-3xl">
                <img
                  src={h.img}
                  alt={h.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <span
                  className="glass absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ color: "var(--ink)" }}
                >
                  {h.tag}
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-xl">{h.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{h.location}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-sm font-medium">
                    <Star className="h-4 w-4 fill-current" style={{ color: "var(--terracotta)" }} />
                    {h.rating}
                    <span className="text-muted-foreground">({h.reviews})</span>
                  </div>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <span className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                      {h.price} €
                    </span>
                    <span className="ml-1 text-sm text-muted-foreground">/ nuit</span>
                  </div>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition"
                    style={{ background: "var(--olive-deep)", color: "var(--cream)" }}
                  >
                    Réserver <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Advantages() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Réservation sécurisée",
      desc: "Paiement chiffré, garantie voyageur et remboursement intégral en cas d'annulation éligible.",
    },
    {
      icon: BadgeCheck,
      title: "Maisons vérifiées",
      desc: "Chaque riad est visité par notre équipe locale. Photos réelles, standards contrôlés.",
    },
    {
      icon: Headphones,
      title: "Support 24 / 7",
      desc: "Une conciergerie francophone et arabophone disponible à toute heure, avant et pendant le séjour.",
    },
  ];
  return (
    <section id="experiences" className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--terracotta)" }}>
          Pourquoi Dyafa
        </p>
        <h2 className="mt-3 text-4xl sm:text-5xl">La confiance, comme un art d'accueil.</h2>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card-float p-8">
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl"
              style={{ background: "color-mix(in oklab, var(--olive) 15%, white)", color: "var(--olive-deep)" }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-6 text-2xl">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="relative py-24 lg:py-32" style={{ background: "var(--ink)" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--terracotta-soft)" }}>
            Ils ont voyagé avec nous
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl" style={{ color: "var(--cream)" }}>
            Des séjours qui laissent une trace.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="rounded-3xl p-8"
              style={{
                background: "color-mix(in oklab, white 6%, transparent)",
                border: "1px solid color-mix(in oklab, white 12%, transparent)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="flex gap-0.5" style={{ color: "var(--terracotta-soft)" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-5 font-display text-lg leading-relaxed" style={{ color: "var(--cream)" }}>
                « {t.quote} »
              </blockquote>
              <figcaption className="mt-6 text-sm" style={{ color: "color-mix(in oklab, var(--cream) 70%, transparent)" }}>
                <div className="font-medium" style={{ color: "var(--cream)" }}>{t.name}</div>
                <div>{t.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
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
            Votre prochain riad n'attend<br className="hidden sm:inline" /> plus que vous.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg" style={{ color: "color-mix(in oklab, var(--cream) 88%, transparent)" }}>
            Réservez en trois clics et laissez-vous accueillir comme un invité d'honneur.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-semibold shadow-float transition hover:-translate-y-0.5"
              style={{ background: "var(--cream)", color: "var(--ink)" }}
            >
              Commencer la recherche <ArrowRight className="h-4 w-4" />
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-medium ring-1 transition hover:bg-white/10"
              style={{ color: "var(--cream)", borderColor: "color-mix(in oklab, white 40%, transparent)" }}
            >
              Parler à un concierge
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contact" className="border-t border-border/70">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-6 py-16 sm:grid-cols-4 lg:px-10">
        <div className="col-span-2 sm:col-span-1">
          <img src={logo} alt="Maroc Résidences" className="h-10 w-auto object-contain" />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            L'hospitalité marocaine, réinventée pour les voyageurs exigeants.
          </p>
        </div>
        {[
          { title: "Explorer", items: ["Destinations", "Maisons d'hôtes", "Expériences", "Cadeaux"] },
          { title: "Hôtes", items: ["Publier un riad", "Ressources", "Charte qualité"] },
          { title: "À propos", items: ["Notre histoire", "Presse", "Contact", "Aide"] },
        ].map((col) => (
          <div key={col.title}>
            <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{col.title}</div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {col.items.map((i) => (
                <li key={i}><a href="#" className="transition hover:text-foreground">{i}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center lg:px-10">
          <div>© {new Date().getFullYear()} Dyafa — Tous droits réservés.</div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-foreground">Confidentialité</a>
            <a href="#" className="hover:text-foreground">CGU</a>
            <a href="#" className="hover:text-foreground">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <Destinations />
      <Houses />
      <Advantages />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}
