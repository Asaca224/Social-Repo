"use client";

import { useState } from "react";

const TIERS = [
  { id: "starter", name: "Starter", accounts: 5, seats: 2 },
  { id: "growth", name: "Growth", accounts: 20, seats: 5 },
  { id: "agency", name: "Agency", accounts: 100, seats: 20 },
] as const;

export default function BillingPage() {
  const [agencyId, setAgencyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = () => ({ "x-agency-id": agencyId, "content-type": "application/json" });

  async function subscribe(tier: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ tier }),
      });
      if (res.status === 503) {
        setError("Billing is not configured (set STRIPE_SECRET_KEY + price ids).");
        return;
      }
      if (!res.ok) {
        setError(`Checkout failed (${res.status})`);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  async function managePlan() {
    setError(null);
    const res = await fetch("/api/billing/portal", { method: "POST", headers: headers() });
    if (res.ok) {
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } else if (res.status === 503) {
      setError("Billing is not configured.");
    } else {
      setError(`Could not open billing portal (${res.status})`);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 24 }}>Billing</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Subscription tiers by connected accounts and seats. (Dev: enter an agency
        id; <code>x-agency-id</code> stands in for the Clerk session.)
      </p>

      <input
        placeholder="agency id"
        value={agencyId}
        onChange={(e) => setAgencyId(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--panel)",
          color: "var(--text)",
          margin: "12px 0",
        }}
      />
      {error && <p style={{ color: "#ff5f5f" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {TIERS.map((t) => (
          <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>{t.name}</h2>
            <ul style={{ color: "var(--muted)", fontSize: 14, paddingLeft: 18 }}>
              <li>{t.accounts} connected accounts</li>
              <li>{t.seats} seats</li>
            </ul>
            <button
              type="button"
              disabled={!agencyId || busy}
              onClick={() => subscribe(t.id)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "none",
                background: !agencyId || busy ? "var(--border)" : "var(--accent)",
                color: "#fff",
                cursor: !agencyId || busy ? "not-allowed" : "pointer",
              }}
            >
              Subscribe
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!agencyId}
        onClick={managePlan}
        style={{
          marginTop: 20,
          padding: "10px 16px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text)",
          cursor: agencyId ? "pointer" : "not-allowed",
        }}
      >
        Manage existing subscription
      </button>
    </main>
  );
}
