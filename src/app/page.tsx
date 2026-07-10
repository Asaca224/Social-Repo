import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <div className="page-head">
        <h1>Welcome to SocialOps</h1>
        <p>
          Manage many clients&apos; social accounts from one place — publishing,
          approvals, scheduling, a unified inbox, and white-labeled reporting.
        </p>
      </div>

      <div className="card">
        <div className="card-title">Get started</div>
        <ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
          <li>
            Open the <Link href="/dashboard">Dashboard</Link> and create your
            agency (your team — the top-level tenant).
          </li>
          <li>Add clients (your customers / workspaces).</li>
          <li>
            Select a client and connect its social accounts (Meta, X, LinkedIn).
          </li>
          <li>Compose, schedule, reply in the inbox, and generate reports.</li>
        </ol>
        <div className="divider" />
        <Link href="/dashboard" className="btn btn-primary">
          Open the dashboard →
        </Link>
      </div>

      <div className="grid-3" style={{ marginTop: 16 }}>
        <Link href="/compose" className="card" style={{ textDecoration: "none" }}>
          <div className="card-title">Composer</div>
          <div className="muted small">Draft one post for many platforms.</div>
        </Link>
        <Link href="/inbox" className="card" style={{ textDecoration: "none" }}>
          <div className="card-title">Inbox</div>
          <div className="muted small">Comments, replies, AI drafts, sentiment.</div>
        </Link>
        <Link href="/billing" className="card" style={{ textDecoration: "none" }}>
          <div className="card-title">Billing</div>
          <div className="muted small">Stripe subscription tiers.</div>
        </Link>
      </div>
    </>
  );
}
