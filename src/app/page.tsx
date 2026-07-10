import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>SocialOps</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Multi-tenant social media management — manage many clients&apos; accounts
        from one place: publishing, approvals, scheduling, inbox, and reporting.
      </p>

      <Link
        href="/dashboard"
        style={{
          display: "inline-block",
          marginTop: 20,
          padding: "12px 20px",
          borderRadius: 10,
          background: "var(--accent)",
          color: "#fff",
          textDecoration: "none",
          fontSize: 16,
        }}
      >
        Open the dashboard →
      </Link>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>Everything else</h2>
        <ul>
          <li>
            <Link href="/dashboard">Dashboard</Link> — manage clients &amp;
            connect social accounts
          </li>
          <li>
            <Link href="/compose">Composer</Link> — draft a post and target
            multiple platforms
          </li>
          <li>
            <Link href="/calendar">Calendar</Link> — scheduled &amp; published
            posts by day
          </li>
          <li>
            <Link href="/inbox">Inbox</Link> — comments across a client&apos;s
            accounts, with replies &amp; canned responses
          </li>
          <li>
            <Link href="/billing">Billing</Link> — subscription tiers (Stripe)
          </li>
          <li>
            <Link href="/api/health">/api/health</Link> — service + adapter status
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 24, color: "var(--muted)", fontSize: 14 }}>
        <p>
          New here? Open the dashboard, create your agency, add a client, then
          connect that client&apos;s social accounts.
        </p>
      </section>
    </main>
  );
}
