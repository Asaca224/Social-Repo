"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/app-context";

interface Post {
  id: string;
  content: string;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "#667085",
  pending_approval: "var(--warn)",
  approved: "var(--success)",
  scheduled: "var(--accent)",
  published: "#7c5cff",
  failed: "var(--danger)",
};
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const startDow = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function CalendarPage() {
  const { agencyId, selectedClient, api } = useApp();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const clientId = selectedClient?.id;
  const load = useCallback(async () => {
    if (!clientId) return;
    const res = await api(`/api/posts?clientId=${clientId}`);
    if (res.ok) setPosts(((await res.json()) as { posts: Post[] }).posts);
  }, [clientId, api]);

  useEffect(() => {
    setPosts([]);
    void load();
  }, [load]);

  if (!agencyId)
    return (
      <div className="empty">
        Set up your agency first. <Link href="/dashboard">Go to the dashboard →</Link>
      </div>
    );

  const byDay = new Map<string, Post[]>();
  for (const p of posts) {
    const when = p.scheduledFor ?? p.publishedAt;
    if (!when) continue;
    const key = when.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }

  const weeks = monthMatrix(cursor.year, cursor.month);
  const label = new Date(cursor.year, cursor.month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const shift = (d: number) => {
    const m = cursor.month + d;
    setCursor({ year: cursor.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };

  return (
    <>
      <div className="page-head">
        <h1>Content calendar</h1>
        <p>Scheduled and published posts by day{selectedClient ? ` for ${selectedClient.name}` : ""}.</p>
      </div>

      {!selectedClient ? (
        <div className="empty">Select a client in the top bar to see its calendar.</div>
      ) : (
        <div className="card">
          <div className="row" style={{ marginBottom: 14 }}>
            <button className="btn btn-sm" onClick={() => shift(-1)}>←</button>
            <strong>{label}</strong>
            <button className="btn btn-sm" onClick={() => shift(1)}>→</button>
            <span className="spacer" />
            <span className="muted small">{posts.length} posts</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
            {DOW.map((d) => (
              <div key={d} className="muted small" style={{ padding: "2px 4px" }}>{d}</div>
            ))}
            {weeks.flat().map((date, i) => {
              const key = date
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                : `e${i}`;
              const dayPosts = date ? byDay.get(key) ?? [] : [];
              return (
                <div
                  key={key}
                  style={{
                    minHeight: 92,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: date ? "var(--surface-2)" : "transparent",
                    padding: 6,
                  }}
                >
                  {date && <div className="muted small">{date.getDate()}</div>}
                  {dayPosts.map((p) => (
                    <div
                      key={p.id}
                      title={p.content}
                      style={{
                        marginTop: 4,
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#fff",
                        background: STATUS_COLOR[p.status] ?? "#667085",
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
        </div>
      )}
    </>
  );
}
