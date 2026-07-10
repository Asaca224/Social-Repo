"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/app-context";

interface Comment {
  id: string;
  authorName: string;
  body: string;
  sentiment: string | null;
  status: string;
  receivedAt: string;
  socialAccount: { platform: string };
}
interface Canned {
  id: string;
  title: string;
  body: string;
}

const STATUS_CLASS: Record<string, string> = {
  open: "badge-accent",
  replied: "badge-success",
  ignored: "badge",
};

export default function InboxPage() {
  const { agencyId, selectedClient, api } = useApp();
  const [comments, setComments] = useState<Comment[]>([]);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const clientId = selectedClient?.id;

  const load = useCallback(async () => {
    if (!clientId) return;
    setError(null);
    const [c, k] = await Promise.all([
      api(`/api/comments?clientId=${clientId}`),
      api(`/api/canned-responses?clientId=${clientId}`),
    ]);
    if (!c.ok) return setError(`Comments failed (${c.status})`);
    setComments(((await c.json()) as { comments: Comment[] }).comments);
    if (k.ok) setCanned(((await k.json()) as { cannedResponses: Canned[] }).cannedResponses);
  }, [clientId, api]);

  useEffect(() => {
    setComments([]);
    setCanned([]);
    void load();
  }, [load]);

  async function sendReply(id: string) {
    const body = drafts[id]?.trim();
    if (!body) return;
    const res = await api(`/api/comments/${id}/reply`, { method: "POST", body: JSON.stringify({ body }) });
    if (res.ok) {
      setDrafts((d) => ({ ...d, [id]: "" }));
      void load();
    } else setError(`Reply failed (${res.status})`);
  }

  async function aiDraft(id: string) {
    setError(null);
    const res = await api(`/api/comments/${id}/ai-draft`, { method: "POST" });
    if (res.ok) {
      const { draft } = (await res.json()) as { draft: string };
      setDrafts((d) => ({ ...d, [id]: draft }));
    } else if (res.status === 503) setError("AI is not configured (set ANTHROPIC_API_KEY).");
    else setError(`AI draft failed (${res.status})`);
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
        <h1>Unified inbox</h1>
        <p>Comments across {selectedClient ? selectedClient.name : "a client"}&apos;s connected accounts.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!selectedClient ? (
        <div className="empty">Select a client in the top bar to load its inbox.</div>
      ) : comments.length === 0 ? (
        <div className="empty">No comments yet for this client.</div>
      ) : (
        <div className="stack">
          {comments.map((c) => (
            <div key={c.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{c.authorName}</strong>
                <span className={`badge ${STATUS_CLASS[c.status] ?? "badge"}`}>{c.status}</span>
              </div>
              <div className="muted small" style={{ margin: "2px 0 8px" }}>
                {c.socialAccount.platform} · {new Date(c.receivedAt).toLocaleString()}
                {c.sentiment ? ` · ${c.sentiment}` : ""}
              </div>
              <p style={{ margin: "0 0 12px" }}>{c.body}</p>

              {canned.length > 0 && (
                <select
                  className="select"
                  style={{ marginBottom: 8 }}
                  defaultValue=""
                  onChange={(e) => {
                    const pick = canned.find((k) => k.id === e.target.value);
                    if (pick) setDrafts((d) => ({ ...d, [c.id]: pick.body }));
                  }}
                >
                  <option value="" disabled>Insert canned response…</option>
                  {canned.map((k) => (
                    <option key={k.id} value={k.id}>{k.title}</option>
                  ))}
                </select>
              )}

              <div className="row">
                <input
                  className="input"
                  placeholder="Write a reply…"
                  value={drafts[c.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                />
                <button className="btn btn-sm" onClick={() => aiDraft(c.id)} title="AI draft (Claude Haiku)">
                  ✨ Draft
                </button>
                <button className="btn btn-primary btn-sm" disabled={!drafts[c.id]?.trim()} onClick={() => sendReply(c.id)}>
                  Reply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
