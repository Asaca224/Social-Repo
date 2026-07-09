"use client";

import { useState } from "react";

const PLATFORMS = [
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "tiktok",
  "google_business",
] as const;

// Character guidance per platform (indicative — real limits enforced per adapter).
const CHAR_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  x: 280,
  linkedin: 3000,
  tiktok: 2200,
  google_business: 1500,
};

export default function ComposePage() {
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<string[]>(["facebook"]);

  const toggle = (p: string) =>
    setSelected((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );

  const minLimit = selected.length
    ? Math.min(...selected.map((p) => CHAR_LIMITS[p] ?? Infinity))
    : Infinity;
  const over = content.length > minLimit;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 24 }}>Composer</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Draft one post and target multiple platforms. Publishing is manual in
        Phase 1 (no scheduling yet).
      </p>

      <fieldset
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
          marginTop: 24,
        }}
      >
        <legend style={{ padding: "0 8px", color: "var(--muted)" }}>
          Target platforms
        </legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PLATFORMS.map((p) => {
            const active = selected.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggle(p)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text)",
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </fieldset>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        placeholder="What do you want to post?"
        style={{
          width: "100%",
          marginTop: 16,
          padding: 12,
          borderRadius: 8,
          border: `1px solid ${over ? "#ff5f5f" : "var(--border)"}`,
          background: "var(--panel)",
          color: "var(--text)",
          fontSize: 15,
          resize: "vertical",
        }}
      />

      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          color: over ? "#ff5f5f" : "var(--muted)",
        }}
      >
        {content.length}
        {Number.isFinite(minLimit) ? ` / ${minLimit}` : ""} characters
        {over ? " — over the smallest selected platform limit" : ""}
      </div>

      <button
        type="button"
        disabled={!content || selected.length === 0 || over}
        onClick={() =>
          alert(
            "Saving drafts is wired at POST /api/posts.\n" +
              "Hooking this button to it (with auth + client selection) is the next step.",
          )
        }
        style={{
          marginTop: 20,
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          background:
            !content || selected.length === 0 || over
              ? "var(--border)"
              : "var(--accent)",
          color: "#fff",
          cursor:
            !content || selected.length === 0 || over ? "not-allowed" : "pointer",
          fontSize: 15,
        }}
      >
        Save draft
      </button>
    </main>
  );
}
