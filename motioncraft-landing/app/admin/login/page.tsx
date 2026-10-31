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
    <main className="min-h-screen bg-[#110e08] text-[#f7f3ee] flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[#16130d] border border-[#2e281f] shadow-2xl space-y-6 text-left">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#191610] border border-[#c8b29b]/40 flex items-center justify-center font-mono text-xs font-bold text-[#c8b29b]">
            SS
          </div>
          <span className="font-semibold text-sm tracking-wider uppercase text-[#f7f3ee]">
            Serenity Studio
          </span>
        </Link>
        <div>
          <p className="text-xs font-mono uppercase text-[#c8b29b] tracking-wider">PRIVATE ACCESS</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#f7f3ee] mt-1">Admin Dashboard</h1>
          <p className="text-xs text-[#9c958c] mt-1">Enter the admin password to view early access qualification telemetry.</p>
        </div>
        <form action={login} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-mono uppercase text-[#eae1d7]">Password</label>
            <input
              name="password"
              type="password"
              required
              autoFocus
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] focus:border-[#c8b29b] focus:outline-none"
            />
          </div>
          {errorMessage && <p className="text-xs text-[#f87171]">{errorMessage}</p>}
          <button className="w-full py-3 rounded-lg bg-[#c8b29b] text-[#110e08] font-bold text-xs uppercase tracking-wider hover:bg-[#d8c4ad] transition-all">
            Enter Dashboard
          </button>
        </form>
      </div>
    </main>
  );
}
