import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Baby,
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
  Menu,
  MessageSquareQuote,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  BedDouble,
  UtensilsCrossed,
  Receipt,
  Search,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";

import { AccountSettings } from "@/components/account-settings";
import { ClientsManagement } from "@/components/clients-management";
import { DashboardOverview } from "@/components/dashboard-overview";
import { HebergementManagement } from "@/components/hebergement-management";
import { MaisonsManagement } from "@/components/maisons-management";
import { ProspectsManagement } from "@/components/prospects-management";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TranchesAgeManagement } from "@/components/tranches-age-management";
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
  | "gestion_saisons"
  | "gestion_chambres"
  | "gestion_supplements"
  | "gestion_tranches_age"
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
  "reservations",
  "gestion_commerciale",
  "promotions",
  "gestion_financiere",
  "paiements",
  "facturation",
  "journal_transactions",
  "chiffre_affaires",
  "avis_clients",
]);

const SIDEBAR_WIDTH_STORAGE_KEY = "maroc-dashboard-sidebar-width";
const SIDEBAR_OPEN_STORAGE_KEY = "maroc-dashboard-sidebar-open";
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MIN_WIDTH = 72;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_COMPACT_THRESHOLD = 200;

function isSidebarCompact(width: number) {
  return width < SIDEBAR_COMPACT_THRESHOLD;
}

function readSidebarWidth() {
  if (typeof window === "undefined") {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));

  if (Number.isFinite(saved) && saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH) {
    return saved;
  }

  return SIDEBAR_DEFAULT_WIDTH;
}

function readSidebarOpen() {
  if (typeof window === "undefined") {
    return true;
  }

  return localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY) !== "false";
}

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  compact = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={compact ? label : undefined}
      className={[
        "flex w-full items-center rounded-xl text-left text-[13px] font-medium transition",
        compact ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
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
      {!compact ? <span className="leading-tight">{label}</span> : null}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)] sm:rounded-[22px] sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[22px]">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">
        {description}
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500">
        Module en préparation — le contenu sera ajouté prochainement.
      </div>
    </div>
  );
}

function SidebarPanel({
  user,
  initials,
  sidebarItems,
  activeView,
  compact = false,
  onNavigate,
  onLogout,
}: {
  user: AuthUser;
  initials: string;
  sidebarItems: { id: DashboardView; label: string; icon: LucideIcon }[];
  activeView: DashboardView;
  compact?: boolean;
  onNavigate: (view: DashboardView) => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#fbfcff]">
      <div className={compact ? "shrink-0 p-2" : "shrink-0 p-4 pb-0 sm:p-5 sm:pb-0"}>
        <div
          className={[
            "rounded-[22px] border border-slate-200 bg-white shadow-[0_14px_34px_-28px_rgba(15,23,42,0.6)] sm:rounded-[26px]",
            compact ? "flex justify-center p-2" : "p-4",
          ].join(" ")}
        >
          <div className={compact ? "flex justify-center" : "flex items-center gap-3"}>
            <div
              className={[
                "grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] text-sm font-semibold text-white",
                compact ? "h-10 w-10" : "h-11 w-11 sm:h-12 sm:w-12",
              ].join(" ")}
              title={`${user.first_name} ${user.last_name}`}
            >
              {initials}
            </div>
            {!compact ? (
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-900">
                  {user.first_name} {user.last_name}
                </p>
                <p className="truncate text-[11px] font-medium text-[#7a34c9]">
                  {getRoleLabel(user.role_id)}
                </p>
                <p className="truncate text-[11px] text-emerald-500">Connecté</p>
              </div>
            ) : null}
          </div>

          {!compact ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate text-[12px] text-slate-400">Maroc Résidences</span>
              <Bell className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
            </div>
          ) : null}
        </div>
      </div>

      <nav
        className={[
          "min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain py-4",
          compact ? "px-2" : "px-4 sm:px-5",
        ].join(" ")}
      >
        {sidebarItems.map((item) => (
          <SidebarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeView === item.id}
            compact={compact}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      <div
        className={[
          "shrink-0 border-t border-slate-200 bg-[#fbfcff]",
          compact ? "p-2" : "p-4 pt-4 sm:p-5",
        ].join(" ")}
      >
        <div className={compact ? "" : "rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"}>
          <Button
            variant="outline"
            title="Déconnexion"
            className={[
              "justify-center rounded-xl border-slate-200 bg-white text-[13px] font-semibold",
              compact ? "h-10 w-full px-0" : "w-full py-5",
            ].join(" ")}
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            {!compact ? "Déconnexion" : null}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [activeView, setActiveView] = useState<DashboardView>("dashboard");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  const sidebarCompact = isSidebarCompact(sidebarWidth);

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
        { id: "gestion_saisons", label: "Gestion des saisons", icon: CalendarRange },
        { id: "gestion_chambres", label: "Gestion des chambres", icon: BedDouble },
        { id: "gestion_tranches_age", label: "Gestion des tranches d'âge", icon: Baby },
        { id: "gestion_supplements", label: "Gestion des suppléments", icon: UtensilsCrossed },
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

  const activeItem = useMemo(() => {
    if (activeView === "account") {
      return { id: "account" as const, label: "Mon compte", icon: UserRound };
    }

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
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, event.clientX)
      );
      setSidebarWidth(nextWidth);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthRef.current));
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
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

  const handleNavigate = (view: DashboardView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarOpen((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(next));
      return next;
    });
  };

  const startSidebarResize = () => {
    setIsResizingSidebar(true);
  };

  const accountMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#c4b5fd] sm:gap-3 sm:px-3 sm:py-2"
        >
          <div className="hidden text-right sm:block">
            <p className="text-[12px] font-semibold text-slate-700">Mon compte</p>
            <p className="max-w-[160px] truncate text-[11px] text-slate-400">{user.email}</p>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3e8ff] text-[12px] font-semibold text-[#7a34c9] sm:h-10 sm:w-10 sm:text-[13px]">
            {initials}
          </div>
          <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-900">
              {user.first_name} {user.last_name}
            </span>
            <span className="truncate text-xs text-slate-500">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onClick={() => handleNavigate("account")}
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
  );

  const renderMainContent = (showSidebarToggle = false) => (
    <>
      <div className="hidden shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-[#fcfcfe] px-6 py-4 lg:flex">
        <div className="flex min-w-0 items-center gap-3">
          {showSidebarToggle ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              title={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-slate-400">Espace pro</p>
            <h1 className="truncate text-[18px] font-semibold text-slate-900">
              {activeItem?.label || "Tableau de bord"}
            </h1>
          </div>
        </div>
        {accountMenu}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-7">
        {activeView === "dashboard" ? (
          <DashboardOverview
            canManageMaisons={canManageGuestHouses}
            isAdmin={isAdmin}
          />
        ) : null}

        {activeView === "maisons" && canManageGuestHouses ? (
          <MaisonsManagement />
        ) : null}

        {activeView === "prospects" && canManageGuestHouses ? (
          <ProspectsManagement />
        ) : null}

        {activeView === "clients" && canManageGuestHouses ? (
          <ClientsManagement />
        ) : null}

        {activeView === "gestion_saisons" && canManageGuestHouses ? (
          <HebergementManagement defaultTab="saisons" singleTab />
        ) : null}

        {activeView === "gestion_chambres" && canManageGuestHouses ? (
          <HebergementManagement defaultTab="chambres" singleTab />
        ) : null}

        {activeView === "gestion_supplements" && canManageGuestHouses ? (
          <HebergementManagement defaultTab="supplements" singleTab />
        ) : null}

        {activeView === "gestion_tranches_age" && canManageGuestHouses ? (
          <TranchesAgeManagement />
        ) : null}

        {activeView === "users" && isAdmin ? (
          <UsersManagement currentUserId={user.id} />
        ) : null}

        {activeView === "account" ? (
          <AccountSettings user={user} onUserUpdated={setUser} />
        ) : null}

        {PLACEHOLDER_VIEWS.has(activeView) &&
        canManageGuestHouses &&
        activeItem &&
        activeItem.id !== "account" ? (
          <PlaceholderModule
            title={activeItem.label}
            description={`Espace dédié à la gestion de « ${activeItem.label.toLowerCase()} ».`}
          />
        ) : null}
      </div>
    </>
  );

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-white p-0 text-slate-900">
      <div className="flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden bg-white">
        {/* Desktop chrome bar */}
        <div className="hidden shrink-0 items-center gap-4 border-b border-slate-200 bg-[#fbfbfe] px-6 py-3 lg:flex">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff605c]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd44]" />
            <span className="h-3 w-3 rounded-full bg-[#00ca4e]" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-400 shadow-sm">
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">https://dashboard.marocresidences.com/panel</span>
          </div>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile top bar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Maroc Résidences
            </p>
            <p className="truncate text-[14px] font-semibold text-slate-900">
              {activeItem?.label || "Tableau de bord"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          {accountMenu}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <div className="hidden min-h-0 flex-1 overflow-hidden lg:flex">
            {sidebarOpen ? (
              <>
                <aside
                  style={{ width: sidebarWidth }}
                  className="h-full min-h-0 shrink-0 overflow-hidden border-r border-slate-200"
                >
                  <SidebarPanel
                    user={user}
                    initials={initials}
                    sidebarItems={sidebarItems}
                    activeView={activeView}
                    compact={sidebarCompact}
                    onNavigate={handleNavigate}
                    onLogout={() => void handleLogout()}
                  />
                </aside>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Redimensionner le menu"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    startSidebarResize();
                  }}
                  className={[
                    "relative z-10 w-1.5 shrink-0 cursor-col-resize border-r border-slate-200 bg-[#f8fafc] transition-colors hover:bg-slate-200",
                    isResizingSidebar ? "bg-slate-300" : "",
                  ].join(" ")}
                />
              </>
            ) : null}

            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fcfcfe]">
              {renderMainContent(true)}
            </section>
          </div>

          {/* Mobile drawer + content */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetContent
                side="left"
                className="flex w-[min(100%,320px)] flex-col border-r border-slate-200 bg-[#fbfcff] p-0 [&>button]:right-3 [&>button]:top-3 [&>button]:z-10"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu de navigation</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 pt-10">
                  <SidebarPanel
                    user={user}
                    initials={initials}
                    sidebarItems={sidebarItems}
                    activeView={activeView}
                    onNavigate={handleNavigate}
                    onLogout={() => void handleLogout()}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fcfcfe]">
              {renderMainContent()}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
