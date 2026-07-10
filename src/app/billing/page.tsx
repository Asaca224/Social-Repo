"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/app-context";

const TIERS = [
  { id: "starter", name: "Starter", accounts: 5, seats: 2, blurb: "For solo operators" },
  { id: "growth", name: "Growth", accounts: 20, seats: 5, blurb: "For growing agencies" },
  { id: "agency", name: "Agency", accounts: 100, seats: 20, blurb: "For full teams" },
] as const;

export default function BillingPage() {
  const { agencyId, api } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function subscribe(tier: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await api("/api/billing/checkout", { method: "POST", body: JSON.stringify({ tier }) });
      if (res.status === 503) return setError("Billing is not configured (set STRIPE_SECRET_KEY + price ids).");
      if (!res.ok) return setError(`Checkout failed (${res.status})`);
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  async function managePlan() {
    setError(null);
    const res = await api("/api/billing/portal", { method: "POST" });
    if (res.ok) {
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } else if (res.status === 503) setError("Billing is not configured.");
    else if (res.status === 409) setError("No subscription yet — subscribe to a plan first.");
    else setError(`Could not open billing portal (${res.status})`);
  }

  if (!agencyId)
    return (
      <div className="empty">
        Set up your agency first. <Link href="/dashboard">Go to the dashboard →</Link>
      </div>
    );

  return (
    <>
      <div className="page-head">
        <h1>Billing</h1>
        <p>Subscription tiers by connected accounts and seats.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid-3">
        {TIERS.map((t) => (
          <div key={t.id} className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>{t.name}</div>
            <div className="muted small" style={{ marginBottom: 12 }}>{t.blurb}</div>
            <ul className="muted small" style={{ paddingLeft: 16, margin: "0 0 16px", lineHeight: 1.8 }}>
              <li>{t.accounts} connected accounts</li>
              <li>{t.seats} seats</li>
            </ul>
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={() => subscribe(t.id)}>
              Subscribe
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Manage subscription</div>
            <div className="muted small">Update payment method, change plan, or view invoices.</div>
          </div>
          <button className="btn" onClick={managePlan}>Open billing portal</button>
        </div>
      </div>
    </>
  );
}
