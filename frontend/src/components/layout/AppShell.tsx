import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Users, Activity, User, ShieldCheck } from "lucide-react";
import { useIdentity } from "../../state/identity";
import { PanicButton } from "../PanicButton";
import { AnimatedBackground } from "../AnimatedBackground";
import { ThemeSwitcher } from "../ThemeSwitcher";

const SHIELD_ICON = (
  <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6 shrink-0" aria-hidden="true">
    <path
      d="M16 2 L28 7 V15 C28 23 22.5 28.5 16 30 C9.5 28.5 4 23 4 15 V7 Z"
      fill="var(--color-bg-elevated)"
      stroke="var(--color-gold)"
      strokeWidth="1.5"
    />
    <path d="M10.5 16.3 L14 19.8 L21.5 11.8" stroke="var(--color-cyan)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

function useNavItems(): NavItem[] {
  const { identity } = useIdentity();
  if (identity?.role === "requester") {
    return [
      { to: "/home", label: "Home", icon: Home },
      { to: "/family", label: "Family", icon: Users },
      { to: "/activity", label: "Activity", icon: Activity },
      { to: "/profile", label: "Profile", icon: User },
    ];
  }
  if (identity?.role === "contact") {
    return [
      { to: "/contact", label: "Inbox", icon: Home },
      { to: `/dashboard/${identity.requester_id ?? ""}`, label: "Family", icon: Users },
      { to: "/profile", label: "Profile", icon: User },
    ];
  }
  return [];
}

function isActive(pathname: string, to: string) {
  if (to === "/home") return pathname === "/home" || pathname.startsWith("/requester");
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { identity } = useIdentity();
  const location = useLocation();
  const navItems = useNavItems();
  const showNav = Boolean(identity) && location.pathname !== "/";

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <AnimatedBackground />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-[var(--color-gold)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#1a1204]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to={identity ? "/home" : "/"} className="flex min-w-0 items-center gap-2 font-bold tracking-tight">
            {SHIELD_ICON}
            <span className="truncate text-[15px]">SafeSignal</span>
          </Link>

          {navItems.length > 0 && (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(location.pathname, item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <ThemeSwitcher />
            </div>
            {identity && (
              <Link to="/" className="hidden text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] sm:inline">
                Switch persona
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className={`mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 ${showNav ? "pb-24 md:pb-8" : ""}`}
      >
        {children}
      </main>

      {showNav && navItems.length > 0 && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(location.pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    active ? "text-[var(--color-gold)]" : "text-[var(--color-text-faint)]"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <footer className="border-t border-[var(--color-border)] px-4 py-6 text-xs text-[var(--color-text-muted)] sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-gold)]" aria-hidden="true" />
            SafeSignal — prototype. Simulated wallet only; no real funds move.
          </p>
          <p>
            Support:{" "}
            <a className="underline decoration-dotted hover:text-[var(--color-text)]" href="mailto:support@safesignal.example">
              support@safesignal.example
            </a>{" "}
            ·{" "}
            <a className="underline decoration-dotted hover:text-[var(--color-text)]" href="tel:+18005550199">
              +1 (800) 555-0199
            </a>
          </p>
        </div>
      </footer>

      <PanicButton />
    </div>
  );
}
