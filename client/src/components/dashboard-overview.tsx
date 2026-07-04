import { useEffect, useMemo, useState } from "react";
import { BedDouble, Building2, Users, UsersRound } from "lucide-react";
import {
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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fetchMaisons, type MaisonListItem } from "@/lib/maisons";
import { getRoleLabel } from "@/lib/roles";
import { fetchUsers } from "@/lib/users";
import type { AuthUser } from "@/lib/auth";

const STATUT_LABELS: Record<string, string> = {
  actif: "Actives",
  inactif: "Inactives",
  en_attente: "En attente",
};

const STATUT_COLORS: Record<string, string> = {
  actif: "#10b981",
  inactif: "#94a3b8",
  en_attente: "#f59e0b",
};

const ROLE_COLORS = ["#8b5cf6", "#3b82f6", "#14b8a6", "#f97316", "#ec4899"];

const statutChartConfig = {
  value: { label: "Maisons" },
  actif: { label: "Actives", color: STATUT_COLORS.actif },
  inactif: { label: "Inactives", color: STATUT_COLORS.inactif },
  en_attente: { label: "En attente", color: STATUT_COLORS.en_attente },
} satisfies ChartConfig;

const villeChartConfig = {
  total: { label: "Maisons", color: "#3b82f6" },
} satisfies ChartConfig;

const roleChartConfig = {
  total: { label: "Utilisateurs", color: "#8b5cf6" },
} satisfies ChartConfig;

type DashboardOverviewProps = {
  canManageMaisons: boolean;
  isAdmin: boolean;
};

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number | string;
  icon: typeof Building2;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)] sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500 sm:text-[12px]">{title}</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-900 sm:mt-2 sm:text-[28px]">
            {value}
          </p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${tone}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </div>
    </article>
  );
}

export function DashboardOverview({
  canManageMaisons,
  isAdmin,
}: DashboardOverviewProps) {
  const [maisons, setMaisons] = useState<MaisonListItem[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const tasks: Promise<void>[] = [];

        if (canManageMaisons) {
          tasks.push(
            fetchMaisons().then((data) => {
              if (!cancelled) {
                setMaisons(data);
              }
            })
          );
        }

        if (isAdmin) {
          tasks.push(
            fetchUsers().then((data) => {
              if (!cancelled) {
                setUsers(data);
              }
            })
          );
        }

        await Promise.all(tasks);
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
  }, [canManageMaisons, isAdmin]);

  const maisonsByStatut = useMemo(() => {
    const counts: Record<string, number> = {
      actif: 0,
      inactif: 0,
      en_attente: 0,
    };

    for (const maison of maisons) {
      const key = maison.statut in counts ? maison.statut : "en_attente";
      counts[key] += 1;
    }

    return Object.entries(counts).map(([key, value]) => ({
      key,
      name: STATUT_LABELS[key] || key,
      value,
      fill: STATUT_COLORS[key] || "#94a3b8",
    }));
  }, [maisons]);

  const maisonsByVille = useMemo(() => {
    const counts = new Map<string, number>();

    for (const maison of maisons) {
      const ville = maison.ville?.trim() || "Non renseignée";
      counts.set(ville, (counts.get(ville) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([ville, total]) => ({ ville, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [maisons]);

  const usersByRole = useMemo(() => {
    const counts = new Map<string, number>();

    for (const user of users) {
      const role = getRoleLabel(user.role_id);
      counts.set(role, (counts.get(role) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([role, total], index) => ({
        role,
        total,
        fill: ROLE_COLORS[index % ROLE_COLORS.length],
      }))
      .sort((a, b) => b.total - a.total);
  }, [users]);

  const totalChambres = maisons.reduce((sum, maison) => sum + (maison.nb_chambres || 0), 0);
  const totalCapacite = maisons.reduce((sum, maison) => sum + (maison.capacite_max || 0), 0);
  const maisonsActives = maisonsByStatut.find((item) => item.key === "actif")?.value || 0;

  if (!canManageMaisons && !isAdmin) {
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
    return <p className="text-[13px] text-slate-500">Chargement des statistiques...</p>;
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="lg:hidden">
        <p className="text-[13px] text-slate-500">
          Vue d&apos;ensemble des données disponibles.
        </p>
      </div>
      <div className="hidden lg:block">
        <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
          Tableau de bord
        </h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Vue d&apos;ensemble des données disponibles.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {canManageMaisons ? (
          <>
            <StatCard
              title="Maisons d'hôtes"
              value={maisons.length}
              icon={Building2}
              tone="bg-[#eff6ff] text-[#2563eb]"
            />
            <StatCard
              title="Maisons actives"
              value={maisonsActives}
              icon={Building2}
              tone="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              title="Chambres"
              value={totalChambres}
              icon={BedDouble}
              tone="bg-violet-50 text-violet-600"
            />
            <StatCard
              title="Capacité totale"
              value={totalCapacite}
              icon={Users}
              tone="bg-amber-50 text-amber-600"
            />
          </>
        ) : null}

        {isAdmin ? (
          <StatCard
            title="Utilisateurs"
            value={users.length}
            icon={UsersRound}
            tone="bg-[#f3e8ff] text-[#7a34c9]"
          />
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {canManageMaisons ? (
          <article className="rounded-[22px] border border-slate-200 bg-white p-5">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Maisons par statut
            </h3>
            <p className="mt-1 text-[12px] text-slate-500">
              Répartition des maisons actives, inactives et en attente.
            </p>

            {maisons.length === 0 ? (
              <p className="mt-8 text-[13px] text-slate-500">Aucune maison enregistrée.</p>
            ) : (
              <ChartContainer config={statutChartConfig} className="mx-auto aspect-square max-h-[280px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie
                    data={maisonsByStatut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {maisonsByStatut.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}

            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {maisonsByStatut.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-[12px] text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  {item.name}: <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        {canManageMaisons ? (
          <article className="rounded-[22px] border border-slate-200 bg-white p-5">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Maisons par ville
            </h3>
            <p className="mt-1 text-[12px] text-slate-500">
              Top des villes avec le plus de maisons d&apos;hôtes.
            </p>

            {maisonsByVille.length === 0 ? (
              <p className="mt-8 text-[13px] text-slate-500">Aucune donnée de ville.</p>
            ) : (
              <ChartContainer config={villeChartConfig} className="mt-4 h-[280px] w-full">
                <BarChart data={maisonsByVille} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="ville"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    angle={maisonsByVille.length > 4 ? -20 : 0}
                    textAnchor={maisonsByVille.length > 4 ? "end" : "middle"}
                    height={maisonsByVille.length > 4 ? 50 : 30}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </article>
        ) : null}

        {isAdmin ? (
          <article className="rounded-[22px] border border-slate-200 bg-white p-5 xl:col-span-2">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Utilisateurs par rôle
            </h3>
            <p className="mt-1 text-[12px] text-slate-500">
              Répartition des comptes selon leur rôle.
            </p>

            {usersByRole.length === 0 ? (
              <p className="mt-8 text-[13px] text-slate-500">Aucun utilisateur enregistré.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartContainer config={roleChartConfig} className="mx-auto aspect-square max-h-[280px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="role" hideLabel />} />
                    <Pie
                      data={usersByRole}
                      dataKey="total"
                      nameKey="role"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {usersByRole.map((entry) => (
                        <Cell key={entry.role} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                <div className="flex flex-col justify-center gap-3">
                  {usersByRole.map((item) => (
                    <div
                      key={item.role}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex items-center gap-2 text-[13px] text-slate-700">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        {item.role}
                      </div>
                      <strong className="text-[14px] text-slate-900">{item.total}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        ) : null}
      </div>
    </div>
  );
}
