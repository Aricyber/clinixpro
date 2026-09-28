"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import {
  getCurrentSessionUser,
  getDefaultSessionUser,
  signOutUser,
} from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { SessionUser } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/appointments", label: "Agenda", icon: CalendarDays, permission: "manageAppointments" },
  { href: "/patients", label: "Pacientes", icon: Users, permission: "managePatients" },
  { href: "/professionals", label: "Profissionais", icon: Stethoscope, permission: "manageProfessionals" },
  { href: "/services", label: "Serviços", icon: BriefcaseBusiness, permission: "manageServices" },
  { href: "/medical-records", label: "Prontuários", icon: ClipboardList, permission: "accessMedicalRecords" },
  { href: "/finance", label: "Financeiro", icon: CreditCard, permission: "manageFinance" },
  { href: "/settings", label: "Configurações", icon: Settings, permission: "manageSettings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const currentSession = await getCurrentSessionUser();
      setSession(currentSession ?? null);

      if (pathname !== "/login" && !currentSession) {
        router.replace("/login");
      }
    }

    loadSession();
  }, [pathname, router]);

  const activeSession = session ?? getDefaultSessionUser();

  const visibleNavItems = navItems.filter(
    (item) => !("permission" in item) || hasPermission(activeSession.role, item.permission),
  );

  const handleLogout = async () => {
    await signOutUser();
    setSession(null);
    router.push("/login");
  };

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-[1800px]">
        <aside className="hidden min-h-screen w-72 bg-slate-900 p-6 text-slate-100 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">SaaS</p>
              <h1 className="text-xl font-bold">ClinixPro</h1>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {visibleNavItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === href ? "bg-slate-800 text-white" : "text-slate-200 hover:bg-slate-800 hover:text-white"}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 text-sm font-semibold text-teal-300">
                {activeSession.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{activeSession.name}</p>
                <p className="truncate text-xs text-slate-400">{activeSession.role}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-700/60 px-3 py-2 text-xs text-slate-200">
              <span className="flex items-center gap-2">
                <ShieldCheck size={14} />
                {activeSession.clinicName}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                  aria-label="Abrir menu"
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Clínica atual</p>
                  <h2 className="text-xl font-semibold text-slate-900">{activeSession.clinicName}</h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700">
                  <Activity size={14} />
                  Operação ativa
                </div>
              </div>
            </div>

            {mobileMenuOpen ? (
              <nav className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 lg:hidden">
                {visibleNavItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === href ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </header>

          <main className="flex-1 p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
