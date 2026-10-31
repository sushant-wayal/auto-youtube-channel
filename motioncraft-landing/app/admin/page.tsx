import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MessageSquare, Trash2, Users, WalletCards, Youtube } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/admin-auth";
import { logout } from "./login/actions";
import { deleteEarlyAccessApplication, deleteFeedback, deleteWaitlistEntry } from "./actions";
import ExportCsvButton from "./ExportCsvButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  if (!isValidAdminToken(jar.get(ADMIN_COOKIE)?.value)) redirect("/admin/login");

  const [earlyAccessApps, legacyEntries, feedback] = await Promise.all([
    prisma.earlyAccessApplication.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const highIntentPaidCount = earlyAccessApps.filter(
    (app) => app.willingnessToPay && !app.willingnessToPay.includes("not currently pay")
  ).length;

  return (
    <main className="min-h-screen bg-[#110e08] text-[#f7f3ee] p-6 sm:p-10 font-sans">
      <nav className="flex items-center justify-between pb-6 border-b border-[#2e281f]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#191610] border border-[#c8b29b]/40 flex items-center justify-center font-mono text-xs font-bold text-[#c8b29b]">
            SS
          </div>
          <div>
            <span className="font-semibold text-sm tracking-wider uppercase text-[#f7f3ee]">
              Serenity Studio
            </span>
            <span className="ml-2 font-mono text-xs text-[#c8b29b]">Admin Telemetry</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportCsvButton data={earlyAccessApps} />
          <form action={logout}>
            <button className="px-3 py-1.5 rounded-md border border-[#2e281f] bg-[#16130d] text-xs font-mono text-[#9c958c] hover:text-[#f7f3ee]">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <header className="py-8 space-y-2 text-left">
        <p className="text-xs font-mono uppercase text-[#c8b29b] tracking-wider">
          MARKET DEMAND SIGNALS
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[#f7f3ee]">
          Founding Creator Applications
        </h1>
        <p className="text-sm text-[#9c958c]">
          Real-time qualification telemetry from YouTube channel operators.
        </p>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-xs font-mono uppercase">Total Applications</span>
            <Users className="w-4 h-4 text-[#c8b29b]" />
          </div>
          <div className="text-3xl font-mono font-bold text-[#f7f3ee] mt-2">
            {earlyAccessApps.length}
          </div>
          <p className="text-[11px] text-[#736d64] mt-1">Founding Cohort Candidates</p>
        </div>

        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-xs font-mono uppercase">Validated Paid Intent</span>
            <WalletCards className="w-4 h-4 text-[#4ade80]" />
          </div>
          <div className="text-3xl font-mono font-bold text-[#4ade80] mt-2">
            {highIntentPaidCount}
          </div>
          <p className="text-[11px] text-[#736d64] mt-1">Ready for Paid Beta Onboarding</p>
        </div>

        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-xs font-mono uppercase">Legacy Waitlist</span>
            <MessageSquare className="w-4 h-4 text-[#9c958c]" />
          </div>
          <div className="text-3xl font-mono font-bold text-[#f7f3ee] mt-2">
            {legacyEntries.length}
          </div>
          <p className="text-[11px] text-[#736d64] mt-1">Previous submissions</p>
        </div>
      </section>

      {/* Main Table: Early Access Applications */}
      <section className="rounded-xl bg-[#16130d] border border-[#2e281f] overflow-hidden text-left mb-8">
        <div className="p-4 border-b border-[#2e281f] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#f7f3ee] uppercase tracking-wider font-mono">
            Candidate Pipeline ({earlyAccessApps.length})
          </h2>
          <span className="text-xs font-mono text-[#c8b29b]">Active Telemetry</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2e281f] bg-[#110e08] text-[#9c958c]">
                <th className="py-3 px-4 text-left font-mono">Applicant</th>
                <th className="py-3 px-4 text-left font-mono">Channel URL</th>
                <th className="py-3 px-4 text-left font-mono">Volume</th>
                <th className="py-3 px-4 text-left font-mono">Current Workflow</th>
                <th className="py-3 px-4 text-left font-mono">Monthly Spend</th>
                <th className="py-3 px-4 text-left font-mono">Willingness to Pay</th>
                <th className="py-3 px-4 text-left font-mono">Bottleneck Notes</th>
                <th className="py-3 px-4 text-left font-mono">Date</th>
                <th className="py-3 px-4 text-right font-mono">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e281f]">
              {earlyAccessApps.map((app) => (
                <tr key={app.id} className="hover:bg-[#191610]">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#f7f3ee]">{app.name}</div>
                    <div className="text-[#736d64] font-mono text-[11px]">{app.email}</div>
                  </td>
                  <td className="py-3 px-4 text-[#c8b29b] font-mono">
                    <a
                      href={app.channelUrl.startsWith("http") ? app.channelUrl : `https://${app.channelUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      <Youtube className="w-3.5 h-3.5 text-[#ef4444]" />
                      <span className="truncate max-w-[160px]">{app.channelUrl}</span>
                    </a>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#9c958c]">
                    <div>{app.channelsCount}</div>
                    <div className="text-[10px] text-[#736d64]">{app.monthlyVideos}</div>
                  </td>
                  <td className="py-3 px-4 text-[#eae1d7]">{app.currentWorkflow}</td>
                  <td className="py-3 px-4 font-mono text-[#9c958c]">{app.monthlySpend}</td>
                  <td className="py-3 px-4 font-mono font-bold text-[#4ade80]">
                    {app.willingnessToPay}
                  </td>
                  <td className="py-3 px-4 max-w-[220px] truncate text-[#736d64]">
                    {app.notes || "—"}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#736d64]">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <form action={deleteEarlyAccessApplication}>
                      <input type="hidden" name="id" value={app.id} />
                      <button
                        title="Delete candidate"
                        className="text-[#736d64] hover:text-[#ef4444] transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {earlyAccessApps.length === 0 && (
            <div className="p-8 text-center text-xs text-[#736d64]">
              No applications submitted yet. The landing page form will stream entries directly here.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
