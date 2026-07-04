import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Maximize,
  MessageSquareQuote,
  Minimize,
  Receipt,
  Search,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";

import { AccountSettings } from "@/components/account-settings";
import { DashboardOverview } from "@/components/dashboard-overview";
import { MaisonsManagement } from "@/components/maisons-management";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UsersManagement } from "@/components/users-management";
import {
  clearAuthToken,
  fetchCurrentUser,
  getAuthToken,
  type AuthUser,
} from "@/lib/auth";
import { canManageMaisons, getRoleLabel, isAdminRole } from "@/lib/roles";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

type DashboardView =
  | "dashboard"
  | "maisons"
  | "prospects"
  | "clients"
  | "reservations"
  | "gestion_commerciale"
  | "gestion_saison"
  | "promotions"
  | "gestion_financiere"
  | "paiements"
  | "facturation"
  | "journal_transactions"
  | "chiffre_affaires"
  | "avis_clients"
  | "users"
  | "account";

const PLACEHOLDER_VIEWS = new Set<DashboardView>([
  "prospects",
  "clients",
  "reservations",
  "gestion_commerciale",
  "gestion_saison",
  "promotions",
  "gestion_financiere",
  "paiements",
  "facturation",
  "journal_transactions",
  "chiffre_affaires",
  "avis_clients",
]);

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition",
        active
          ? "bg-[#dff4ff] text-[#183b63] shadow-[inset_0_0_0_1px_rgba(126,194,225,0.45)]"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
          active
            ? "border-[#b8e1f4] bg-white text-[#3a78b4]"
            : "border-slate-200 bg-white text-slate-400",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="leading-tight">{label}</span>
    </button>
  );
}

function PlaceholderModule({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)]">
      <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">
        {description}
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500">
        Module en préparation — le contenu sera ajouté prochainement.
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [activeView, setActiveView] = useState<DashboardView>("dashboard");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const initials = user
    ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase()
    : "";

  const isAdmin = isAdminRole(user?.role_id);
  const canManageGuestHouses = canManageMaisons(user?.role_id);

  const sidebarItems = useMemo(() => {
    const items: { id: DashboardView; label: string; icon: LucideIcon }[] = [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    ];

    if (canManageGuestHouses) {
      items.push(
        { id: "maisons", label: "Maisons d'hôtes", icon: Home },
        { id: "prospects", label: "Prospects", icon: UserPlus },
        { id: "clients", label: "Clients", icon: Users },
        { id: "reservations", label: "Réservations", icon: CalendarDays },
        { id: "gestion_commerciale", label: "Gestion commerciale", icon: BriefcaseBusiness },
        { id: "gestion_saison", label: "Gestion saison", icon: CalendarRange },
        { id: "promotions", label: "Promotions", icon: BadgePercent },
        { id: "gestion_financiere", label: "Gestion financière", icon: Wallet },
        { id: "paiements", label: "Paiements", icon: CreditCard },
        { id: "facturation", label: "Facturation", icon: Receipt },
        { id: "journal_transactions", label: "Journal des transactions", icon: ClipboardList },
        { id: "chiffre_affaires", label: "Chiffre d'affaires", icon: CircleDollarSign },
        { id: "avis_clients", label: "Gestion avis clients", icon: MessageSquareQuote }
      );
    }

    if (isAdmin) {
      items.push({ id: "users", label: "Utilisateurs", icon: UsersRound });
    }

    return items;
  }, [canManageGuestHouses, isAdmin]);

  const activePlaceholder = useMemo(() => {
    return sidebarItems.find((item) => item.id === activeView);
  }, [activeView, sidebarItems]);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      const token = getAuthToken();

      if (!token) {
        if (!cancelled) {
          setUser(null);
          await navigate({ to: "/" });
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
          await navigate({ to: "/" });
        }
      }
    };

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!panelRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await panelRef.current.requestFullscreen();
      }
    } catch {
      // Le navigateur peut refuser le plein écran (permissions, iframe, etc.)
    }
  };

  if (user === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-sm text-muted-foreground">Chargement de votre espace...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    clearAuthToken();
    await navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-3 py-3 text-slate-900 sm:px-4 lg:px-5">
      <div
        ref={panelRef}
        className={[
          "mx-auto overflow-hidden border border-slate-200 bg-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.42)]",
          isFullscreen
            ? "flex h-screen max-w-none flex-col rounded-none"
            : "max-w-[1460px] rounded-[28px]",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-[#fbfbfe] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff605c]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd44]" />
            <span className="h-3 w-3 rounded-full bg-[#00ca4e]" />
          </div>
          <div className="flex min-w-[220px] flex-1 items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-400 shadow-sm">
            <Search className="h-4 w-4" />
            <span className="truncate">https://dashboard.marocresidences.com/panel</span>
          </div>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>

        <div
          className={[
            "grid min-h-0 lg:grid-cols-[280px_1fr]",
            isFullscreen ? "flex-1" : "h-[calc(100vh-7.5rem)]",
          ].join(" ")}
        >
          <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-[#fbfcff]">
            <div className="shrink-0 p-5 pb-0">
              <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.6)]">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] text-sm font-semibold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-900">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="truncate text-[11px] font-medium text-[#7a34c9]">
                      {getRoleLabel(user.role_id)}
                    </p>
                    <p className="truncate text-[11px] text-emerald-500">Connecté</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
                  <Search className="h-4 w-4 text-slate-400" />
                  <span className="text-[12px] text-slate-400">Maroc Résidences</span>
                  <Bell className="ml-auto h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-5 py-4">
              {sidebarItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={activeView === item.id}
                  onClick={() => setActiveView(item.id)}
                />
              ))}
            </nav>

            <div className="shrink-0 border-t border-slate-200 bg-[#fbfcff] p-5 pt-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <Button
                  variant="outline"
                  className="w-full justify-center rounded-xl border-slate-200 bg-white py-5 text-[13px] font-semibold"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </Button>
              </div>
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto bg-[#fcfcfe] p-4 sm:p-6 lg:p-7">
            <div className="mb-6 flex items-start justify-end">
              <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.42)] sm:p-5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#c4b5fd]"
                    >
                      <div className="text-right">
                        <p className="text-[12px] font-semibold text-slate-700">Mon compte</p>
                        <p className="text-[11px] text-slate-400">{user.email}</p>
                      </div>
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f3e8ff] text-[13px] font-semibold text-[#7a34c9]">
                        {initials}
                      </div>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-900">
                          {user.first_name} {user.last_name}
                        </span>
                        <span className="text-xs text-slate-500">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2"
                      onClick={() => setActiveView("account")}
                    >
                      <UserRound className="h-4 w-4" />
                      Gérer mon compte
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-red-600 focus:bg-red-50 focus:text-red-700"
                      onClick={() => void handleLogout()}
                    >
                      <LogOut className="h-4 w-4" />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {activeView === "dashboard" ? (
              <DashboardOverview
                canManageMaisons={canManageGuestHouses}
                isAdmin={isAdmin}
              />
            ) : null}

            {activeView === "maisons" && canManageGuestHouses ? (
              <MaisonsManagement />
            ) : null}

            {activeView === "users" && isAdmin ? (
              <UsersManagement currentUserId={user.id} />
            ) : null}

            {activeView === "account" ? (
              <AccountSettings user={user} onUserUpdated={setUser} />
            ) : null}

            {PLACEHOLDER_VIEWS.has(activeView) && canManageGuestHouses && activePlaceholder ? (
              <PlaceholderModule
                title={activePlaceholder.label}
                description={`Espace dédié à la gestion de « ${activePlaceholder.label.toLowerCase()} ».`}
              />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
