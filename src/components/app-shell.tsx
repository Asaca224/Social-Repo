"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "./app-context";

const NAV = [
  { href: "/dashboard", label: "Dashboard", ic: "▦" },
  { href: "/compose", label: "Composer", ic: "✎" },
  { href: "/calendar", label: "Calendar", ic: "▤" },
  { href: "/inbox", label: "Inbox", ic: "✉" },
  { href: "/billing", label: "Billing", ic: "▪" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, agencyId, clients, clientId, setClientId, clearSession } = useApp();

  return (
    <div className="app">
      <nav className="sidebar">
        <Link href="/" className="brand">
          <span className="dot" />
          SocialOps
        </Link>
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} className={`nav-link${active ? " active" : ""}`}>
              <span className="ic">{n.ic}</span>
              {n.label}
            </Link>
          );
        })}
        <div className="sidebar-foot">Multi-tenant social management</div>
      </nav>

      <div className="content">
        <header className="topbar">
          <div className="topbar-left">
            {ready && agencyId ? (
              <>
                <span className="badge badge-accent" title={`Agency ${agencyId}`}>
                  Agency · {agencyId.slice(0, 8)}
                </span>
                {clients.length > 0 && (
                  <select
                    className="select"
                    style={{ width: "auto", minWidth: 180 }}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  >
                    <option value="">All clients</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <span className="muted small">Not signed in</span>
            )}
          </div>
          <div className="row">
            {ready && agencyId && (
              <button type="button" className="btn btn-sm" onClick={clearSession}>
                Switch agency
              </button>
            )}
          </div>
        </header>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}
