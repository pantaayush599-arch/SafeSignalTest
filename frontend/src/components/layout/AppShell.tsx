import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useIdentity } from "../../state/identity";

const SHIELD_ICON = (
  <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6 shrink-0" aria-hidden="true">
    <path d="M16 2 L28 7 V15 C28 23 22.5 28.5 16 30 C9.5 28.5 4 23 4 15 V7 Z" fill="#0F172A" stroke="#22D3B8" strokeWidth="1.5" />
    <path d="M10.5 16.3 L14 19.8 L21.5 11.8" stroke="#22D3B8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { identity } = useIdentity();
  const location = useLocation();

  const links: { to: string; label: string }[] = [];
  if (identity?.role === "requester") {
    links.push({ to: "/requester", label: "New request" });
    links.push({ to: "/requester/history", label: "My requests" });
  }
  if (identity?.role === "contact") {
    links.push({ to: "/contact", label: "Verification inbox" });
  }
  links.push({ to: "/", label: "Switch persona" });

  return (
    <>
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          onClick={onNavigate}
          aria-current={location.pathname === l.to ? "page" : undefined}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            location.pathname === l.to
              ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              : "text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { identity } = useIdentity();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-[var(--color-brand)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2 font-bold tracking-tight">
            {SHIELD_ICON}
            <span className="truncate text-[15px]">SafeSignal</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLinks />
          </nav>

          <div className="flex items-center gap-3">
            {identity && (
              <span className="hidden text-xs text-[var(--color-text-muted)] sm:inline">
                {identity.role === "requester" ? "Requester" : "Trusted contact"}:{" "}
                <span className="font-semibold text-[var(--color-text)]">{identity.name}</span>
              </span>
            )}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border-strong)] md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
              {menuOpen ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Mobile"
            className="border-t border-[var(--color-border)] px-4 py-2 md:hidden"
          >
            <div className="flex flex-col gap-1 py-2">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-[var(--color-border)] px-4 py-6 text-xs text-[var(--color-text-muted)] sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>SafeSignal — prototype. Simulated wallet only; no real funds move.</p>
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
    </div>
  );
}
