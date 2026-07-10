"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/app-context";

const PLATFORMS = ["facebook", "instagram", "x", "linkedin", "tiktok", "google_business"] as const;
const CHAR_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  x: 280,
  linkedin: 3000,
  tiktok: 2200,
  google_business: 1500,
};

export default function ComposePage() {
  const { agencyId, userId, selectedClient, api } = useApp();
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<string[]>(["facebook"]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (p: string) =>
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const minLimit = selected.length
    ? Math.min(...selected.map((p) => CHAR_LIMITS[p] ?? Infinity))
    : Infinity;
  const over = content.length > minLimit;
  const canSave = Boolean(content && selected.length && !over && selectedClient && userId && !busy);

  async function saveDraft() {
    if (!selectedClient) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          clientId: selectedClient.id,
          createdBy: userId,
          content,
          platformTargets: selected,
        }),
      });
      if (res.ok) {
        setMsg({ kind: "ok", text: "Draft saved." });
        setContent("");
      } else {
        setMsg({ kind: "err", text: `Save failed (${res.status})` });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!agencyId) return <NeedsAgency />;

  return (
    <>
      <div className="page-head">
        <h1>Composer</h1>
        <p>Draft one post and target multiple platforms. Publishing is manual in Phase 1.</p>
      </div>

      {!selectedClient && (
        <div className="alert" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
          Pick a client in the top bar to save drafts to it.
        </div>
      )}
      {msg && (
        <div className={`alert ${msg.kind === "ok" ? "" : "alert-error"}`} style={msg.kind === "ok" ? { background: "var(--success-soft)", color: "var(--success)" } : undefined}>
          {msg.text}
        </div>
      )}

      <div className="card">
        <label className="label">Target platforms</label>
        <div className="row wrap" style={{ marginBottom: 16 }}>
          {PLATFORMS.map((p) => (
            <button key={p} type="button" className={`chip${selected.includes(p) ? " on" : ""}`} onClick={() => toggle(p)}>
              {p}
            </button>
          ))}
        </div>

        <label className="label">Content</label>
        <textarea
          className="textarea"
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What do you want to post?"
          style={over ? { borderColor: "var(--danger)" } : undefined}
        />
        <div className="small" style={{ marginTop: 6, color: over ? "var(--danger)" : "var(--muted)" }}>
          {content.length}
          {Number.isFinite(minLimit) ? ` / ${minLimit}` : ""} characters
          {over ? " — over the smallest selected platform limit" : ""}
        </div>

        <div className="divider" />
        <div className="row">
          <button className="btn btn-primary" disabled={!canSave} onClick={saveDraft}>
            {busy ? "Saving…" : "Save draft"}
          </button>
          {selectedClient && !userId && (
            <span className="muted small">
              Saving needs the admin user from agency setup — recreate the agency in the dashboard to enable it.
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function NeedsAgency() {
  return (
    <div className="empty">
      Set up your agency first. <Link href="/dashboard">Go to the dashboard →</Link>
    </div>
  );
}
