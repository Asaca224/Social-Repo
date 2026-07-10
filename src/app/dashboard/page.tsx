"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  createdAt: string;
}
interface Account {
  id: string;
  platform: string;
  externalAccountId: string;
  status: string;
}

const PLATFORMS: { value: string; label: string; hint: string }[] = [
  { value: "facebook", label: "Facebook", hint: "Facebook Page ID" },
  { value: "instagram", label: "Instagram", hint: "Instagram business account ID" },
  { value: "x", label: "X (Twitter)", hint: "X user ID" },
  { value: "linkedin", label: "LinkedIn", hint: "Author URN, e.g. urn:li:person:xxxx" },
  { value: "tiktok", label: "TikTok", hint: "TikTok account ID" },
  { value: "google_business", label: "Google Business", hint: "Location ID" },
];

const AGENCY_KEY = "socialops.agencyId";

export default function DashboardPage() {
  const [agencyId, setAgencyId] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const headers = useCallback(
    () => ({ "x-agency-id": agencyId, "content-type": "application/json" }),
    [agencyId],
  );

  // Restore the agency from localStorage (dev stand-in for the Clerk session).
  useEffect(() => {
    setAgencyId(localStorage.getItem(AGENCY_KEY) ?? "");
    setReady(true);
  }, []);

  const loadClients = useCallback(async () => {
    if (!agencyId) return;
    setError(null);
    const res = await fetch("/api/clients", { headers: headers() });
    if (!res.ok) return setError(`Load clients failed (${res.status})`);
    setClients(((await res.json()) as { clients: Client[] }).clients);
  }, [agencyId, headers]);

  useEffect(() => {
    if (ready && agencyId) void loadClients();
  }, [ready, agencyId, loadClients]);

  const loadAccounts = useCallback(
    async (clientId: string) => {
      const res = await fetch(`/api/social-accounts?clientId=${clientId}`, { headers: headers() });
      if (res.ok) setAccounts(((await res.json()) as { accounts: Account[] }).accounts);
    },
    [headers],
  );

  function selectClient(c: Client) {
    setSelected(c);
    setAccounts([]);
    void loadAccounts(c.id);
  }

  function chooseAgency(id: string) {
    localStorage.setItem(AGENCY_KEY, id);
    setAgencyId(id);
    setSelected(null);
  }

  if (!ready) return null;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Agency dashboard</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Manage your client workspaces and their connected social accounts.
      </p>
      {error && <p style={{ color: "#ff5f5f" }}>{error}</p>}

      {!agencyId ? (
        <WorkspaceSetup onReady={chooseAgency} setError={setError} />
      ) : (
        <>
          <div style={sessionBar}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              Agency&nbsp;<code>{agencyId}</code>
            </span>
            <button type="button" style={ghostBtn} onClick={() => chooseAgency("")}>
              Switch agency
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, marginTop: 20 }}>
            <ClientList
              clients={clients}
              selectedId={selected?.id}
              onSelect={selectClient}
              headers={headers}
              onCreated={loadClients}
              setError={setError}
            />
            <section>
              {selected ? (
                <ClientDetail
                  client={selected}
                  accounts={accounts}
                  agencyId={agencyId}
                  headers={headers}
                  reloadAccounts={() => loadAccounts(selected.id)}
                  setError={setError}
                />
              ) : (
                <p style={{ color: "var(--muted)" }}>Select or create a client to manage its accounts.</p>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function WorkspaceSetup({
  onReady,
  setError,
}: {
  onReady: (id: string) => void;
  setError: (s: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [existing, setExisting] = useState("");

  async function createAgency() {
    setError(null);
    const res = await fetch("/api/agencies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, adminEmail: email }),
    });
    if (res.status === 403) {
      setError("Clerk is enabled — agencies are provisioned from your Clerk organization.");
      return;
    }
    if (!res.ok) return setError(`Create agency failed (${res.status})`);
    const { agencyId } = (await res.json()) as { agencyId: string };
    onReady(agencyId);
  }

  return (
    <div style={{ ...card, marginTop: 20, maxWidth: 520 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Get started</h2>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        Create your agency (this is you / your team — the top-level tenant), then add clients under it.
      </p>
      <input placeholder="Agency name" value={name} onChange={(e) => setName(e.target.value)} style={input} />
      <input placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
      <button type="button" style={primaryBtn} disabled={!name || !email} onClick={createAgency}>
        Create agency
      </button>
      <div style={{ borderTop: "1px solid var(--border)", margin: "18px 0" }} />
      <p style={{ color: "var(--muted)", fontSize: 13 }}>Already have an agency id?</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="agency id" value={existing} onChange={(e) => setExisting(e.target.value)} style={{ ...input, margin: 0, flex: 1 }} />
        <button type="button" style={ghostBtn} disabled={!existing} onClick={() => onReady(existing)}>
          Use
        </button>
      </div>
    </div>
  );
}

function ClientList({
  clients,
  selectedId,
  onSelect,
  headers,
  onCreated,
  setError,
}: {
  clients: Client[];
  selectedId?: string;
  onSelect: (c: Client) => void;
  headers: () => Record<string, string>;
  onCreated: () => void;
  setError: (s: string | null) => void;
}) {
  const [name, setName] = useState("");

  async function createClient() {
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return setError(`Create client failed (${res.status})`);
    setName("");
    onCreated();
  }

  return (
    <aside style={card}>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Clients</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input placeholder="New client name" value={name} onChange={(e) => setName(e.target.value)} style={{ ...input, margin: 0, flex: 1 }} />
        <button type="button" style={ghostBtn} disabled={!name} onClick={createClient}>
          Add
        </button>
      </div>
      {clients.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13 }}>No clients yet.</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {clients.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${selectedId === c.id ? "var(--accent)" : "var(--border)"}`,
                background: selectedId === c.id ? "rgba(79,140,255,0.12)" : "transparent",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ClientDetail({
  client,
  accounts,
  agencyId,
  headers,
  reloadAccounts,
  setError,
}: {
  client: Client;
  accounts: Account[];
  agencyId: string;
  headers: () => Record<string, string>;
  reloadAccounts: () => void;
  setError: (s: string | null) => void;
}) {
  const [platform, setPlatform] = useState(PLATFORMS[0]!.value);
  const [externalAccountId, setExternalAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const hint = PLATFORMS.find((p) => p.value === platform)?.hint ?? "";

  async function connect() {
    setError(null);
    const res = await fetch("/api/social-accounts", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ clientId: client.id, platform, externalAccountId, accessToken }),
    });
    if (res.status === 402) {
      setError("Account limit reached for your plan — upgrade in Billing to connect more.");
      return;
    }
    if (!res.ok) return setError(`Connect failed (${res.status})`);
    setExternalAccountId("");
    setAccessToken("");
    reloadAccounts();
  }

  async function openReport() {
    const res = await fetch(`/api/clients/${client.id}/report?summary=1`, { headers: headers() });
    if (!res.ok) return setError(`Report failed (${res.status})`);
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>{client.name}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="/compose" style={linkBtn}>Composer</Link>
          <Link href="/calendar" style={linkBtn}>Calendar</Link>
          <Link href="/inbox" style={linkBtn}>Inbox</Link>
          <button type="button" style={linkBtn} onClick={openReport}>Report</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 0 }}>
          Client id: <code>{client.id}</code> · agency <code>{agencyId}</code>
        </p>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Connected accounts</h3>
        {accounts.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No accounts connected yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px" }}>
            {accounts.map((a) => (
              <li key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span>
                  <strong>{a.platform}</strong>{" "}
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>{a.externalAccountId}</span>
                </span>
                <span style={{ fontSize: 12, color: a.status === "connected" ? "#2f9e57" : "#d19a00" }}>{a.status}</span>
              </li>
            ))}
          </ul>
        )}

        <h4 style={{ fontSize: 14, margin: "12px 0 6px" }}>Connect an account</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={input}>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <input placeholder={hint} value={externalAccountId} onChange={(e) => setExternalAccountId(e.target.value)} style={input} />
          <input placeholder="Access token (stored encrypted)" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} style={input} />
          <button type="button" style={primaryBtn} disabled={!externalAccountId || !accessToken} onClick={connect}>
            Connect account
          </button>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
            Paste the platform account id and an access token (e.g. a Meta Page token). A one-click
            OAuth flow is a planned enhancement; tokens are encrypted at rest.
          </p>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
  background: "var(--panel)",
};
const sessionBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 16,
};
const input: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  margin: "6px 0",
  width: "100%",
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
};
const linkBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  textDecoration: "none",
  cursor: "pointer",
  fontSize: 14,
};
