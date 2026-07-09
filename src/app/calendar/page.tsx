"use client";

import { useState } from "react";

interface Post {
  id: string;
  content: string;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "#6b7280",
  pending_approval: "#d19a00",
  approved: "#2f9e57",
  scheduled: "#4f8cff",
  published: "#7c5cff",
  failed: "#ff5f5f",
};

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [agencyId, setAgencyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  async function load() {
    setError(null);
    try {
      const res = await fetch(
        `/api/posts?clientId=${encodeURIComponent(clientId)}`,
        { headers: { "x-agency-id": agencyId } },
      );
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        setPosts([]);
        return;
      }
      const data = (await res.json()) as { posts: Post[] };
      setPosts(data.posts);
    } catch {
      setError("Network error");
    }
  }

  // Index posts by YYYY-MM-DD of their scheduled (or published) date.
  const byDay = new Map<string, Post[]>();
  for (const p of posts) {
    const when = p.scheduledFor ?? p.publishedAt;
    if (!when) continue;
    const key = when.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }

  const weeks = monthMatrix(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  const shift = (delta: number) => {
    const m = cursor.month + delta;
    setCursor({
      year: cursor.year + Math.floor(m / 12),
      month: ((m % 12) + 12) % 12,
    });
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 24 }}>Content calendar</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Scheduled and published posts by day. (Dev: enter an agency + client id
        to load — the <code>x-agency-id</code> header stands in for the Clerk
        session.)
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <input
          placeholder="agency id"
          value={agencyId}
          onChange={(e) => setAgencyId(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="client id"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          style={inputStyle}
        />
        <button type="button" onClick={load} disabled={!agencyId || !clientId} style={btnStyle}>
          Load
        </button>
      </div>
      {error && <p style={{ color: "#ff5f5f" }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
        <button type="button" onClick={() => shift(-1)} style={btnStyle}>
          ←
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" onClick={() => shift(1)} style={btnStyle}>
          →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {DOW.map((d) => (
          <div key={d} style={{ color: "var(--muted)", fontSize: 12, padding: "4px 6px" }}>
            {d}
          </div>
        ))}
        {weeks.flat().map((date, i) => {
          const key = date
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
            : `empty-${i}`;
          const dayPosts = date ? (byDay.get(key) ?? []) : [];
          return (
            <div
              key={key}
              style={{
                minHeight: 88,
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: date ? "var(--panel)" : "transparent",
                padding: 6,
              }}
            >
              {date && (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {date.getDate()}
                </div>
              )}
              {dayPosts.map((p) => (
                <div
                  key={p.id}
                  title={p.content}
                  style={{
                    marginTop: 4,
                    padding: "2px 6px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: STATUS_COLOR[p.status] ?? "#6b7280",
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.content || "(untitled)"}
                </div>
              ))}
            </div>
          );
        })}
      </div>
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
