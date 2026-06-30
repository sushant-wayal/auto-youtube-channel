import Link from "next/link";
import { login } from "./actions";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage =
    error === "missing"
      ? "ADMIN_PASSWORD is not configured. Add it to .env and restart the dev server."
      : error
        ? "That password is not correct."
        : "";

  return (
    <main className="admin-shell login-shell">
      <form action={login} className="login-card">
        <Link href="/" className="brand"><span className="brand-mark">M</span> motioncraft</Link>
        <div><p className="eyebrow">PRIVATE ACCESS</p><h1>Admin dashboard</h1><p>Enter the password configured for this deployment.</p></div>
        <label>Password<input name="password" type="password" required autoFocus placeholder="••••••••••••" /></label>
        {errorMessage && <p className="form-error">{errorMessage}</p>}
        <button className="primary-button">Continue</button>
      </form>
    </main>
  );
}
