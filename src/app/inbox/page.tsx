"use client";

import { useState } from "react";

interface Comment {
  id: string;
  authorName: string;
  body: string;
  sentiment: string | null;
  assignedTo: string | null;
  status: string;
  receivedAt: string;
  socialAccount: { platform: string; externalAccountId: string };
}

interface Canned {
  id: string;
  title: string;
  body: string;
}

const STATUS_COLOR: Record<string, string> = {
  open: "#4f8cff",
  replied: "#2f9e57",
  ignored: "#6b7280",
};

export default function InboxPage() {
  const [agencyId, setAgencyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const headers = () => ({ "x-agency-id": agencyId, "content-type": "application/json" });

  async function load() {
    setError(null);
    try {
      const [cRes, kRes] = await Promise.all([
        fetch(`/api/comments?clientId=${encodeURIComponent(clientId)}`, { headers: headers() }),
        fetch(`/api/canned-responses?clientId=${encodeURIComponent(clientId)}`, { headers: headers() }),
      ]);
      if (!cRes.ok) {
        setError(`Comments request failed (${cRes.status})`);
        return;
      }
      setComments(((await cRes.json()) as { comments: Comment[] }).comments);
      if (kRes.ok) setCanned(((await kRes.json()) as { cannedResponses: Canned[] }).cannedResponses);
    } catch {
      setError("Network error");
    }
  }

  async function sendReply(commentId: string) {
    const body = drafts[commentId]?.trim();
    if (!body) return;
    const res = await fetch(`/api/comments/${commentId}/reply`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      setDrafts((d) => ({ ...d, [commentId]: "" }));
      void load();
    } else {
      setError(`Reply failed (${res.status})`);
    }
  }

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 24 }}>Unified inbox</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Comments across a client&apos;s connected accounts. (Dev: enter agency +
        client id; <code>x-agency-id</code> stands in for the Clerk session.)
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <input placeholder="agency id" value={agencyId} onChange={(e) => setAgencyId(e.target.value)} style={inputStyle} />
        <input placeholder="client id" value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputStyle} />
        <button type="button" onClick={load} disabled={!agencyId || !clientId} style={btnStyle}>
          Load
        </button>
      </div>
      {error && <p style={{ color: "#ff5f5f" }}>{error}</p>}

      {comments.length === 0 && <p style={{ color: "var(--muted)" }}>No comments loaded.</p>}

      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {comments.map((c) => (
          <li key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: "var(--panel)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong>{c.authorName}</strong>
              <span style={{ fontSize: 12, color: "#fff", background: STATUS_COLOR[c.status] ?? "#6b7280", borderRadius: 999, padding: "2px 8px" }}>
                {c.status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 8px" }}>
              {c.socialAccount.platform} · {new Date(c.receivedAt).toLocaleString()}
            </div>
            <p style={{ margin: "0 0 10px" }}>{c.body}</p>

            {canned.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  const pick = canned.find((k) => k.id === e.target.value);
                  if (pick) setDrafts((d) => ({ ...d, [c.id]: pick.body }));
                }}
                style={{ ...inputStyle, marginBottom: 8 }}
              >
                <option value="" disabled>
                  Insert canned response…
                </option>
                {canned.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title}
                  </option>
                ))}
              </select>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Write a reply…"
                value={drafts[c.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={() => sendReply(c.id)} disabled={!drafts[c.id]?.trim()} style={btnStyle}>
                Reply
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--panel)",
  color: "var(--text)",
};

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
};
