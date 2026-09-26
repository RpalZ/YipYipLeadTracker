import Link from "next/link";
import { cookies } from "next/headers";

import { InterfacePreferenceControls } from "@/components/interface-preferences";
import { uiCopy } from "@/lib/i18n";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/interface-preferences";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const cookieStore = await cookies();
  const locale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  const copy = uiCopy[locale];
  return (
    <main className="login-shell">
      <section className="login-context">
        <Link href="/" className="brand-mark large">YY</Link>
        <div>
          <p className="eyebrow">{copy.login.eyebrow}</p>
          <h1>{copy.login.title}</h1>
          <p>{copy.login.intro}</p>
        </div>
        <small>{copy.login.promise}</small>
      </section>
      <section className="login-card">
        <InterfacePreferenceControls />
        <div>
          <p className="eyebrow">{copy.login.access}</p>
          <h2>{copy.login.signIn}</h2>
          <p>{copy.login.account}</p>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <form action={signIn}>
          <label>{copy.login.email}<input type="email" name="email" autoComplete="email" required placeholder="you@yipyip.nl" /></label>
          <label>{copy.login.password}<input type="password" name="password" autoComplete="current-password" required placeholder={copy.login.passwordPlaceholder} /></label>
          <button type="submit">{copy.login.signIn}</button>
        </form>
        <div className="demo-options" aria-label={copy.login.demoOptions}>
          <Link href="/?demo=empty&reset=1">{copy.login.emptyDemo}</Link>
          <Link href="/?demo=sample">{copy.login.sample}</Link>
        </div>
      </section>
    </main>
  );
}
