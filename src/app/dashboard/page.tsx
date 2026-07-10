"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/app-context";

interface Account {
  id: string;
  platform: string;
  externalAccountId: string;
  accountType: string | null;
  status: string;
}

const PLATFORMS: { value: string; label: string; hint: string }[] = [
  { value: "facebook", label: "Facebook", hint: "Facebook Page ID" },
  { value: "instagram", label: "Instagram", hint: "Instagram Business/Creator account ID (IG user id)" },
  { value: "x", label: "X (Twitter)", hint: "X user ID" },
  { value: "linkedin", label: "LinkedIn", hint: "Author URN, e.g. urn:li:person:xxxx" },
  { value: "tiktok", label: "TikTok", hint: "TikTok account ID" },
  { value: "google_business", label: "Google Business", hint: "Location ID" },
];

export default function DashboardPage() {
  const app = useApp();

  if (!app.ready) return null;
  if (!app.agencyId) return <Onboarding />;

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p>Manage your client workspaces and their connected social accounts.</p>
      </div>
      <OAuthResultBanner />
      <div className="grid-2">
        <ClientsPanel />
        <AccountsPanel />
      </div>
    </>
  );
}

/** Shows the outcome of the Meta OAuth redirect (reads ?oauth= then clears it). */
function OAuthResultBanner() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (!oauth) return;
    const map: Record<string, { ok: boolean; text: string }> = {
      connected: { ok: true, text: `Connected ${params.get("count") ?? ""} account(s) via Meta.` },
      denied: { ok: false, text: "Meta authorization was cancelled." },
      notconfigured: { ok: false, text: "Meta OAuth isn't configured (set META_APP_ID / META_APP_SECRET)." },
      noagency: { ok: false, text: "Couldn't determine your agency for the OAuth flow." },
      noclient: { ok: false, text: "That client wasn't found for OAuth." },
      badstate: { ok: false, text: "OAuth state was invalid or expired — please retry." },
      error: { ok: false, text: "Something went wrong connecting via Meta." },
    };
    setMsg(map[oauth] ?? null);
    // Strip the query so a refresh doesn't re-show it.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (!msg) return null;
  return (
    <div
      className={`alert ${msg.ok ? "" : "alert-error"}`}
      style={msg.ok ? { background: "var(--success-soft)", color: "var(--success)" } : undefined}
    >
      {msg.text}
    </div>
  );
}

function Onboarding() {
  const { setSession } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [existing, setExisting] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createAgency() {
    setError(null);
    const res = await fetch("/api/agencies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, adminEmail: email }),
    });
    if (res.status === 403) {
      setError("Clerk is enabled — agencies come from your Clerk organization.");
      return;
    }
    if (!res.ok) {
      const detail = await res
        .json()
        .then((d: { error?: string }) => d.error)
        .catch(() => null);
      return setError(detail ?? `Create agency failed (${res.status})`);
    }
    const { agencyId, adminUserId } = (await res.json()) as {
      agencyId: string;
      adminUserId?: string;
    };
    setSession(agencyId, adminUserId);
  }

  return (
    <>
      <div className="page-head">
        <h1>Set up your agency</h1>
        <p>Your agency is the top-level tenant — you and your team. Create it to begin.</p>
      </div>
      <div className="card" style={{ maxWidth: 520 }}>
        {error && <div className="alert alert-error">{error}</div>}
        <label className="label">Agency name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northwind Social" />
        <div style={{ height: 12 }} />
        <label className="label">Admin email</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" />
        <div style={{ height: 16 }} />
        <button className="btn btn-primary" disabled={!name || !email} onClick={createAgency}>
          Create agency
        </button>
        <div className="divider" />
        <label className="label">Already have an agency id?</label>
        <div className="row">
          <input className="input" value={existing} onChange={(e) => setExisting(e.target.value)} placeholder="agency id" />
          <button className="btn" disabled={!existing} onClick={() => setSession(existing)}>
            Use
          </button>
        </div>
      </div>
    </>
  );
}

function ClientsPanel() {
  const { clients, clientId, setClientId, reloadClients, api } = useApp();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createClient() {
    setError(null);
    const res = await api("/api/clients", { method: "POST", body: JSON.stringify({ name }) });
    if (!res.ok) return setError(`Create client failed (${res.status})`);
    setName("");
    await reloadClients();
  }

  return (
    <aside className="card">
      <div className="card-title">Clients</div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New client name" />
        <button className="btn" disabled={!name} onClick={createClient}>
          Add
        </button>
      </div>
      {clients.length === 0 ? (
        <div className="empty">No clients yet. Add your first customer above.</div>
      ) : (
        <ul className="list">
          {clients.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`nav-link${clientId === c.id ? " active" : ""}`}
                style={{
                  width: "100%",
                  color: clientId === c.id ? "#fff" : "var(--text)",
                  background: clientId === c.id ? "var(--accent)" : "transparent",
                }}
                onClick={() => setClientId(c.id)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function AccountsPanel() {
  const { selectedClient, agencyId, api } = useApp();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState(PLATFORMS[0]!.value);
  const [accountType, setAccountType] = useState("business");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const isInstagram = platform === "instagram";
  const personalBlocked = isInstagram && accountType === "personal";

  const clientId = selectedClient?.id;

  const load = useCallback(async () => {
    if (!clientId) return;
    const res = await api(`/api/social-accounts?clientId=${clientId}`);
    if (res.ok) setAccounts(((await res.json()) as { accounts: Account[] }).accounts);
  }, [clientId, api]);

  useEffect(() => {
    setAccounts([]);
    void load();
  }, [load]);

  async function connect() {
    if (!clientId) return;
    setError(null);
    const res = await api("/api/social-accounts", {
      method: "POST",
      body: JSON.stringify({
        clientId,
        platform,
        externalAccountId,
        accessToken,
        ...(isInstagram ? { accountType } : {}),
      }),
    });
    if (res.status === 402) {
      setError("Account limit reached — upgrade your plan in Billing to connect more.");
      return;
    }
    if (!res.ok) {
      const detail = await res.json().then((d: { error?: string }) => d.error).catch(() => null);
      return setError(detail ?? `Connect failed (${res.status})`);
    }
    setExternalAccountId("");
    setAccessToken("");
    await load();
  }

  async function openReport() {
    if (!clientId) return;
    const res = await api(`/api/clients/${clientId}/report?summary=1`);
    if (!res.ok) return setError(`Report failed (${res.status})`);
    window.open(URL.createObjectURL(await res.blob()), "_blank");
  }

  if (!selectedClient) {
    return (
      <section>
        <div className="empty">Select a client on the left to manage its accounts.</div>
      </section>
    );
  }

  const hint = PLATFORMS.find((p) => p.value === platform)?.hint ?? "";

  return (
    <section className="stack">
      <div className="card">
        <div className="row wrap" style={{ justifyContent: "space-between" }}>
          <div className="card-title" style={{ margin: 0 }}>{selectedClient.name}</div>
          <div className="row wrap">
            <Link href="/compose" className="btn btn-sm">Compose</Link>
            <Link href="/calendar" className="btn btn-sm">Calendar</Link>
            <Link href="/inbox" className="btn btn-sm">Inbox</Link>
            <button className="btn btn-sm" onClick={openReport}>Report</button>
          </div>
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Client <code>{selectedClient.id}</code> · agency <code>{agencyId}</code>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Connected accounts</div>
        {error && <div className="alert alert-error">{error}</div>}
        {accounts.length === 0 ? (
          <div className="empty">No accounts connected yet.</div>
        ) : (
          <ul className="list">
            {accounts.map((a) => (
              <li key={a.id} className="list-row">
                <span>
                  <strong style={{ textTransform: "capitalize" }}>{a.platform}</strong>{" "}
                  {a.accountType && <span className="badge" style={{ marginRight: 6 }}>{a.accountType}</span>}
                  <span className="muted small">{a.externalAccountId}</span>
                </span>
                <span className={`badge ${a.status === "connected" ? "badge-success" : "badge-warn"}`}>
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="divider" />
        <div className="card-title">Connect an account</div>

        <a
          className="btn btn-primary"
          href={`/api/oauth/meta/start?agencyId=${encodeURIComponent(agencyId)}&clientId=${selectedClient.id}`}
          style={{ textDecoration: "none" }}
        >
          Connect with Facebook / Instagram
        </a>
        <div className="muted small" style={{ margin: "8px 0 14px" }}>
          Log in on Meta&apos;s page and approve — we import your Pages and linked
          Instagram accounts automatically. No password is shared with us.
        </div>

        <div className="divider" />
        <div className="muted small" style={{ marginBottom: 10 }}>Or connect manually</div>
        <div className="stack">
          <div>
            <label className="label">Platform</label>
            <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {isInstagram && (
            <div>
              <label className="label">Account type</label>
              <select className="select" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                <option value="business">Business</option>
                <option value="creator">Creator</option>
                <option value="personal">Personal</option>
              </select>
              {personalBlocked && (
                <div className="alert" style={{ marginTop: 8, background: "var(--warn-soft)", color: "var(--warn)" }}>
                  Instagram personal accounts have no API and can&apos;t be connected. In the
                  Instagram app: <strong>Settings → Account type and tools → Switch to
                  professional account</strong> (Business or Creator), then reconnect.
                </div>
              )}
            </div>
          )}
          <div>
            <label className="label">Account id</label>
            <input className="input" placeholder={hint} value={externalAccountId} onChange={(e) => setExternalAccountId(e.target.value)} />
          </div>
          <div>
            <label className="label">Access token</label>
            <input className="input" placeholder="Stored encrypted at rest" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={!externalAccountId || !accessToken || personalBlocked} onClick={connect}>
            Connect account
          </button>
          <div className="muted small">
            Paste the platform account id and an access token (e.g. a Meta Page token).
            One-click OAuth is a planned enhancement; tokens are encrypted at rest.
          </div>
        </div>
      </div>
    </section>
  );
}
