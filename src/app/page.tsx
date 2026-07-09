import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>SocialOps</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Multi-tenant social media management. Publishing, approval workflow, and
        scheduling.
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>Try it</h2>
        <ul>
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
            <Link href="/api/health">/api/health</Link> — service + adapter status
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 24, color: "var(--muted)", fontSize: 14 }}>
        <p>
          See <code>docs/roadmap.md</code> for what lands next: Stripe billing,
          white-label client portals, and PDF reports.
        </p>
      </section>
    </main>
  );
}
