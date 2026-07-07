import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Baby,
  BedDouble,
  Building2,
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fetchDashboardStats, type DashboardStats } from "@/lib/dashboard";

const MAISON_COLORS: Record<string, string> = {
  actif: "#10b981",
  inactif: "#94a3b8",
  en_attente: "#f59e0b",
};

const PROSPECT_COLORS: Record<string, string> = {
  nouveau: "#3b82f6",
  contacte: "#8b5cf6",
  en_negociation: "#f59e0b",
  converti: "#10b981",
  perdu: "#ef4444",
};

const SOURCE_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#db2777",
  "#059669",
  "#ca8a04",
  "#64748b",
];

const RESERVATION_COLORS: Record<string, string> = {
  en_attente: "#f59e0b",
  confirmee: "#10b981",
  annulee: "#ef4444",
  terminee: "#3b82f6",
  no_show: "#94a3b8",
};

const RESERVATION_PAIEMENT_COLORS: Record<string, string> = {
  non_paye: "#ef4444",
  acompte_paye: "#f59e0b",
  paye_totalement: "#10b981",
  rembourse: "#8b5cf6",
};

const evolutionChartConfig = {
  prospects: { label: "Prospects", color: "#3b82f6" },
  clients: { label: "Clients", color: "#10b981" },
} satisfies ChartConfig;

const villeChartConfig = {
  total: { label: "Maisons", color: "#2563eb" },
} satisfies ChartConfig;

const allotementChartConfig = {
  allotement: { label: "Allotement", color: "#7c3aed" },
} satisfies ChartConfig;

const saisonsChartConfig = {
  total: { label: "Saisons", color: "#f59e0b" },
} satisfies ChartConfig;

const nationaliteChartConfig = {
  total: { label: "Clients", color: "#14b8a6" },
} satisfies ChartConfig;

const prospectStatutChartConfig = {
  total: { label: "Prospects", color: "#3b82f6" },
} satisfies ChartConfig;

const prospectSourceChartConfig = {
  total: { label: "Prospects", color: "#8b5cf6" },
} satisfies ChartConfig;

const reservationEvolutionChartConfig = {
  reservations: { label: "Réservations", color: "#2563eb" },
  chiffre_affaires: { label: "Chiffre d'affaires", color: "#10b981" },
} satisfies ChartConfig;

const reservationSourceChartConfig = {
  total: { label: "Réservations", color: "#7c3aed" },
} satisfies ChartConfig;

const reservationMaisonChartConfig = {
  total: { label: "Réservations", color: "#0891b2" },
} satisfies ChartConfig;

function formatCurrency(value: number) {
  const absolute = Math.abs(value);
  const [integerPart, decimalPart = "00"] = absolute.toFixed(2).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `${grouped},${decimalPart} MAD`;
}

type DashboardOverviewProps = {
  canManageMaisons: boolean;
};

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)] sm:p-4">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500 sm:text-[12px]">{title}</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-900 sm:mt-2 sm:text-[28px]">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-[11px] text-slate-400 sm:text-[12px]">{hint}</p>
          ) : null}
        </div>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${tone}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </div>
    </article>
  );
}

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.5)] ${className}`}
    >
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-[12px] text-slate-500">{description}</p>
      {children}
    </article>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <p className="mt-8 flex h-[220px] items-center justify-center text-[13px] text-slate-500">
      {message}
    </p>
  );
}

export function DashboardOverview({ canManageMaisons }: DashboardOverviewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageMaisons) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchDashboardStats();

        if (!cancelled) {
          setStats(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger les statistiques.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [canManageMaisons]);

  const maisonsByStatut = useMemo(() => {
    if (!stats) return [];

    return stats.maisons_par_statut.map((item) => ({
      ...item,
      name: item.label,
      value: item.total,
      fill: MAISON_COLORS[item.key] || "#94a3b8",
    }));
  }, [stats]);

  const prospectsByStatut = useMemo(() => {
    if (!stats) return [];

    return stats.prospects_par_statut.map((item) => ({
      ...item,
      fill: PROSPECT_COLORS[item.key] || "#64748b",
    }));
  }, [stats]);

  const prospectsBySource = useMemo(() => {
    if (!stats) return [];

    return stats.prospects_par_source.map((item, index) => ({
      ...item,
      fill: SOURCE_COLORS[index % SOURCE_COLORS.length],
    }));
  }, [stats]);

  const reservationsByStatut = useMemo(() => {
    if (!stats) return [];

    return stats.reservations_par_statut.map((item) => ({
      ...item,
      name: item.label,
      value: item.total,
      fill: RESERVATION_COLORS[item.key] || "#64748b",
    }));
  }, [stats]);

  const reservationsBySource = useMemo(() => {
    if (!stats) return [];

    return stats.reservations_par_source.map((item, index) => ({
      ...item,
      fill: SOURCE_COLORS[index % SOURCE_COLORS.length],
    }));
  }, [stats]);

  const reservationsByPaiement = useMemo(() => {
    if (!stats) return [];

    return stats.reservations_par_paiement.map((item) => ({
      ...item,
      name: item.label,
      value: item.total,
      fill: RESERVATION_PAIEMENT_COLORS[item.key] || "#64748b",
    }));
  }, [stats]);

  const clientsVip = useMemo(() => {
    if (!stats) return [];

    return stats.clients_vip.map((item, index) => ({
      ...item,
      name: item.label,
      value: item.total,
      fill: item.vip ? "#f59e0b" : "#94a3b8",
      key: item.vip ? "vip" : "standard",
    }));
  }, [stats]);

  const chambresByStatut = useMemo(() => {
    if (!stats) return [];

    return stats.chambres_par_statut.map((item) => ({
      ...item,
      name: item.label,
      value: item.total,
      fill: item.key === "actif" ? "#10b981" : "#94a3b8",
    }));
  }, [stats]);

  if (!canManageMaisons) {
    return (
      <div className="rounded-[22px] border border-slate-200 bg-white p-6">
        <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
          Tableau de bord
        </h2>
        <p className="mt-2 text-[13px] text-slate-500">
          Bienvenue dans votre espace. Utilisez le menu pour gérer votre compte.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-[24px] bg-slate-100" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-[22px] bg-slate-100" />
          <div className="h-80 animate-pulse rounded-[22px] bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
        {error || "Aucune donnée disponible."}
      </div>
    );
  }

  const { summary } = stats;

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#312e81] p-5 text-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.65)] sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Vue opérationnelle en temps réel
            </div>
            <h2 className="text-[24px] font-semibold tracking-tight sm:text-[30px]">
              Tableau de bord
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] text-white/75 sm:text-[14px]">
              Pilotez vos maisons, votre pipeline commercial et votre offre hébergement depuis une
              seule vue.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm">
              <p className="text-[11px] text-white/65">Prospects</p>
              <p className="mt-1 text-[20px] font-semibold">{summary.prospects}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm">
              <p className="text-[11px] text-white/65">Réservations</p>
              <p className="mt-1 text-[20px] font-semibold">{summary.reservations}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm">
              <p className="text-[11px] text-white/65">Chiffre d&apos;affaires</p>
              <p className="mt-1 text-[18px] font-semibold">
                {formatCurrency(summary.chiffre_affaires_reservations)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-sm">
              <p className="text-[11px] text-white/65">Capacité</p>
              <p className="mt-1 text-[20px] font-semibold">{summary.capacite_totale}</p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Maisons d'hôtes"
          value={summary.maisons}
          hint={`${summary.maisons_actives} actives`}
          icon={Building2}
          tone="bg-[#eff6ff] text-[#2563eb]"
        />
        <StatCard
          title="Chambres"
          value={summary.chambres}
          hint={`${summary.chambres_actives} actives`}
          icon={BedDouble}
          tone="bg-violet-50 text-violet-600"
        />
        <StatCard
          title="Prospects"
          value={summary.prospects}
          hint={`${summary.prospects_convertis} convertis`}
          icon={UserPlus}
          tone="bg-sky-50 text-sky-600"
        />
        <StatCard
          title="Clients"
          value={summary.clients}
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Saisons"
          value={summary.saisons}
          icon={CalendarRange}
          tone="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Suppléments actifs"
          value={summary.supplements_actifs}
          icon={UtensilsCrossed}
          tone="bg-orange-50 text-orange-600"
        />
        <StatCard
          title="Tranches d'âge"
          value={summary.tranches_age}
          icon={Baby}
          tone="bg-pink-50 text-pink-600"
        />
        <StatCard
          title="Taux de conversion"
          value={`${summary.taux_conversion}%`}
          hint="Prospects → clients"
          icon={Target}
          tone="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          title="Réservations"
          value={summary.reservations}
          hint={`${summary.reservations_confirmees} confirmées · ${summary.reservations_en_attente} en attente`}
          icon={CalendarDays}
          tone="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Chiffre d'affaires"
          value={formatCurrency(summary.chiffre_affaires_reservations)}
          hint="Hors réservations annulées"
          icon={CircleDollarSign}
          tone="bg-teal-50 text-teal-600"
        />
      </div>

      <ChartCard
        title="Évolution commerciale"
        description="Nouveaux prospects et clients enregistrés sur les 6 derniers mois."
        className="xl:col-span-2"
      >
        {stats.evolution_mensuelle.every(
          (item) => item.prospects === 0 && item.clients === 0
        ) ? (
          <EmptyChart message="Pas encore d'activité commerciale sur cette période." />
        ) : (
          <ChartContainer config={evolutionChartConfig} className="mt-4 h-[300px] w-full">
            <AreaChart data={stats.evolution_mensuelle} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fillProspects" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-prospects)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-prospects)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillClients" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-clients)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-clients)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="prospects"
                stroke="var(--color-prospects)"
                fill="url(#fillProspects)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="clients"
                stroke="var(--color-clients)"
                fill="url(#fillClients)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Évolution des réservations"
          description="Nouvelles réservations et chiffre d'affaires sur les 6 derniers mois."
        >
          {stats.reservations_evolution_mensuelle.every(
            (item) => item.reservations === 0 && item.chiffre_affaires === 0
          ) ? (
            <EmptyChart message="Pas encore de réservation sur cette période." />
          ) : (
            <ChartContainer config={reservationEvolutionChartConfig} className="mt-4 h-[300px] w-full">
              <AreaChart
                data={stats.reservations_evolution_mensuelle}
                margin={{ left: 4, right: 8, top: 8 }}
              >
                <defs>
                  <linearGradient id="fillReservations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-reservations)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-reservations)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillCaReservations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chiffre_affaires)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-chiffre_affaires)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="reservations"
                  stroke="var(--color-reservations)"
                  fill="url(#fillReservations)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="chiffre_affaires"
                  stroke="var(--color-chiffre_affaires)"
                  fill="url(#fillCaReservations)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Réservations par source"
          description="Canaux d'acquisition des réservations (site, plateformes, agence…)."
        >
          {reservationsBySource.length === 0 ? (
            <EmptyChart message="Aucune réservation enregistrée." />
          ) : (
            <ChartContainer config={reservationSourceChartConfig} className="mt-4 h-[300px] w-full">
              <BarChart
                data={reservationsBySource}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                  {reservationsBySource.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Pipeline prospects"
          description="Répartition des prospects par étape du cycle de vente."
        >
          {prospectsByStatut.length === 0 ? (
            <EmptyChart message="Aucun prospect enregistré." />
          ) : (
            <ChartContainer config={prospectStatutChartConfig} className="mt-4 h-[280px] w-full">
              <BarChart data={prospectsByStatut} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {prospectsByStatut.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Sources d'acquisition"
          description="D'où viennent vos prospects (site, agence, plateformes…)."
        >
          {prospectsBySource.length === 0 ? (
            <EmptyChart message="Aucune source renseignée." />
          ) : (
            <ChartContainer config={prospectSourceChartConfig} className="mt-4 h-[280px] w-full">
              <BarChart
                data={prospectsBySource}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                  {prospectsBySource.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Maisons par statut"
          description="Répartition des maisons actives, inactives et en attente."
        >
          {maisonsByStatut.length === 0 ? (
            <EmptyChart message="Aucune maison enregistrée." />
          ) : (
            <>
              <ChartContainer
                config={{
                  value: { label: "Maisons" },
                  ...Object.fromEntries(
                    maisonsByStatut.map((item) => [
                      item.key,
                      { label: item.name, color: item.fill },
                    ])
                  ),
                }}
                className="mx-auto mt-2 aspect-square max-h-[260px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie
                    data={maisonsByStatut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {maisonsByStatut.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {maisonsByStatut.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 text-[12px] text-slate-600"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    {item.name}: <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Maisons par ville"
          description="Top des villes avec le plus de maisons d'hôtes."
        >
          {stats.maisons_par_ville.length === 0 ? (
            <EmptyChart message="Aucune donnée de ville." />
          ) : (
            <ChartContainer config={villeChartConfig} className="mt-4 h-[280px] w-full">
              <BarChart
                data={stats.maisons_par_ville}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="ville"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  angle={stats.maisons_par_ville.length > 4 ? -20 : 0}
                  textAnchor={stats.maisons_par_ville.length > 4 ? "end" : "middle"}
                  height={stats.maisons_par_ville.length > 4 ? 50 : 30}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Capacité par maison"
          description="Allotement total de chambres par établissement."
        >
          {stats.chambres_par_maison.length === 0 ? (
            <EmptyChart message="Aucune chambre configurée." />
          ) : (
            <ChartContainer config={allotementChartConfig} className="mt-4 h-[280px] w-full">
              <BarChart
                data={stats.chambres_par_maison}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="maison"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="allotement" fill="var(--color-allotement)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Saisons par maison"
          description="Nombre de périodes tarifaires configurées par établissement."
        >
          {stats.saisons_par_maison.length === 0 ? (
            <EmptyChart message="Aucune saison définie." />
          ) : (
            <ChartContainer config={saisonsChartConfig} className="mt-4 h-[280px] w-full">
              <BarChart
                data={stats.saisons_par_maison}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="maison"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Clients par nationalité"
          description="Principales nationalités de votre base clients."
          className="xl:col-span-2"
        >
          {stats.clients_par_nationalite.length === 0 ? (
            <EmptyChart message="Aucun client enregistré." />
          ) : (
            <ChartContainer config={nationaliteChartConfig} className="mt-4 h-[260px] w-full">
              <BarChart
                data={stats.clients_par_nationalite}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="nationalite"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Segmentation clients"
          description="Répartition entre clients VIP et standard."
        >
          {clientsVip.length === 0 ? (
            <EmptyChart message="Aucun client enregistré." />
          ) : (
            <>
              <ChartContainer
                config={{
                  value: { label: "Clients" },
                  vip: { label: "VIP", color: "#f59e0b" },
                  standard: { label: "Standard", color: "#94a3b8" },
                }}
                className="mx-auto mt-2 aspect-square max-h-[220px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie
                    data={clientsVip}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={82}
                    paddingAngle={4}
                  >
                    {clientsVip.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="mt-3 space-y-2">
                {clientsVip.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                  >
                    <div className="flex items-center gap-2 text-slate-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      {item.name}
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Chambres par statut"
          description="Chambres actives vs inactives dans le parc hébergement."
        >
          {chambresByStatut.length === 0 ? (
            <EmptyChart message="Aucune chambre configurée." />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ChartContainer
                config={{
                  value: { label: "Chambres" },
                  actif: { label: "Actives", color: "#10b981" },
                  inactif: { label: "Inactives", color: "#94a3b8" },
                }}
                className="mx-auto aspect-square max-h-[220px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie
                    data={chambresByStatut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={4}
                  >
                    {chambresByStatut.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>

              <div className="flex flex-col justify-center gap-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-emerald-700">
                    <TrendingUp className="h-4 w-4" />
                    Parc hébergement
                  </div>
                  <p className="mt-2 text-[26px] font-semibold text-slate-900">
                    {summary.chambres_actives}
                    <span className="ml-1 text-[14px] font-normal text-slate-500">
                      / {summary.chambres} chambres
                    </span>
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {summary.saisons} saisons · {summary.supplements_actifs} suppléments ·{" "}
                    {summary.tranches_age} tranches d&apos;âge
                  </p>
                </div>
                {chambresByStatut.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-center gap-2 text-[13px] text-slate-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      {item.name}
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Réservations par statut"
          description="Suivi des réservations confirmées, en attente, annulées et terminées."
        >
          {reservationsByStatut.length === 0 ? (
            <EmptyChart message="Aucune réservation enregistrée." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartContainer
                config={{
                  value: { label: "Réservations" },
                  ...Object.fromEntries(
                    reservationsByStatut.map((item) => [
                      item.key,
                      { label: item.name, color: item.fill },
                    ])
                  ),
                }}
                className="mx-auto aspect-square max-h-[260px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie
                    data={reservationsByStatut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {reservationsByStatut.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>

              <div className="flex flex-col justify-center gap-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-blue-700">
                    <TrendingUp className="h-4 w-4" />
                    Activité réservations
                  </div>
                  <p className="mt-2 text-[26px] font-semibold text-slate-900">
                    {summary.reservations_confirmees}
                    <span className="ml-1 text-[14px] font-normal text-slate-500">
                      / {summary.reservations} confirmées
                    </span>
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {summary.reservations_en_attente} en attente ·{" "}
                    {formatCurrency(summary.chiffre_affaires_reservations)} de CA
                  </p>
                </div>
                {reservationsByStatut.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-center gap-2 text-[13px] text-slate-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      {item.name}
                    </div>
                    <strong className="text-[14px] text-slate-900">{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Réservations par maison"
          description="Volume de réservations par établissement."
        >
          {stats.reservations_par_maison.length === 0 ? (
            <EmptyChart message="Aucune maison enregistrée." />
          ) : (
            <ChartContainer config={reservationMaisonChartConfig} className="mt-4 h-[280px] w-full">
              <BarChart
                data={stats.reservations_par_maison}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="maison"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Statut de paiement"
          description="Répartition des réservations selon l'état du paiement."
        >
          {reservationsByPaiement.length === 0 ? (
            <EmptyChart message="Aucune réservation enregistrée." />
          ) : (
            <>
              <ChartContainer
                config={{
                  value: { label: "Réservations" },
                  ...Object.fromEntries(
                    reservationsByPaiement.map((item) => [
                      item.key,
                      { label: item.name, color: item.fill },
                    ])
                  ),
                }}
                className="mx-auto mt-2 aspect-square max-h-[260px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie
                    data={reservationsByPaiement}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {reservationsByPaiement.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {reservationsByPaiement.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 text-[12px] text-slate-600"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    {item.name}: <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
