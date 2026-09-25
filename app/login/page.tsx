import Link from "next/link";

import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-context">
        <Link href="/" className="brand-mark large">YY</Link>
        <div>
          <p className="eyebrow">YipYip early signal</p>
          <h1>See the opportunity before it becomes a tender.</h1>
          <p>One review surface for fresh signals, sourced claims, qualification gaps, and the next useful action.</p>
        </div>
        <small>Small signal set. Deep evidence. Human judgment.</small>
      </section>
      <section className="login-card">
        <div>
          <p className="eyebrow">Workspace access</p>
          <h2>Sign in</h2>
          <p>Use the account connected to your YipYip workspace.</p>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <form action={signIn}>
          <label>Email<input type="email" name="email" autoComplete="email" required placeholder="you@yipyip.nl" /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required placeholder="Your password" /></label>
          <button type="submit">Sign in</button>
        </form>
        <div className="demo-options" aria-label="Demo workspace options">
          <Link href="/?demo=empty&reset=1">Start with an empty demo</Link>
          <Link href="/?demo=sample">View sample project leads</Link>
        </div>
      </section>
    </main>
  );
}
