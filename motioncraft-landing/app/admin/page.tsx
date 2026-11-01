import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  MousePointerClick,
  Play,
  Trash2,
  Users,
  WalletCards,
  Youtube,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/admin-auth";
import { logout } from "./login/actions";
import { deleteEarlyAccessApplication } from "./actions";
import ExportCsvButton from "./ExportCsvButton";
import { WILLINGNESS_TO_PAY_OPTIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams?: Promise<{ range?: string }>;
}

function safeGetHostname(raw?: string | null): string {
  if (!raw || raw === "direct") return "Direct / Organic";
  try {
    const formatted = raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `https://${raw}`;
    return new URL(formatted).hostname || raw;
  } catch {
    return raw.replace(/^[a-z]+:\/\//i, "").split("/")[0] || raw;
  }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const jar = await cookies();
  if (!isValidAdminToken(jar.get(ADMIN_COOKIE)?.value)) {
    redirect("/admin/login");
  }

  let range = "all";
  try {
    const resolved = searchParams ? await searchParams : {};
    range = (resolved && (resolved as any).range) || "all";
  } catch {
    range = "all";
  }

  // Compute date filter boundary
  const now = new Date();
  let startDate = new Date(0);
  if (range === "7d") {
    startDate = new Date(now.getTime() - 7 * 864e5);
  } else if (range === "30d") {
    startDate = new Date(now.getTime() - 30 * 864e5);
  } else if (range === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Fetch analytics events & applications with try-catch safety
  let events: any[] = [];
  let applications: any[] = [];

  try {
    const whereClause = range === "all" ? {} : { createdAt: { gte: startDate } };

    const [eventsRes, appsRes] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      }).catch((e) => {
        console.warn("[Admin] analyticsEvent query fallback:", e);
        return [];
      }),
      prisma.earlyAccessApplication.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      }).catch((e) => {
        console.warn("[Admin] earlyAccessApplication query fallback:", e);
        return [];
      }),
    ]);

    events = eventsRes || [];
    applications = appsRes || [];
  } catch (err) {
    console.error("[Admin Page] Unexpected database error:", err);
  }

  // Aggregate Traffic Metrics
  const uniqueVisitors = new Set(events.map((e) => e.visitorId).filter(Boolean)).size;
  const uniqueSessions = new Set(events.map((e) => e.sessionId).filter(Boolean)).size;
  const pageViews = events.filter((e) => e.eventType === "page_view").length;

  // Aggregate Video Engagement
  const videoImpressions = events.filter((e) => e.eventType === "video_impression").length;
  const videoPlays = events.filter((e) => e.eventType === "video_play").length;
  const video25 = events.filter((e) => e.eventType === "video_progress_25").length;
  const video50 = events.filter((e) => e.eventType === "video_progress_50").length;
  const video75 = events.filter((e) => e.eventType === "video_progress_75").length;
  const video100 = events.filter((e) => e.eventType === "video_progress_100").length;
  const videoCompletionRate =
    videoPlays > 0 ? ((video100 / videoPlays) * 100).toFixed(1) : "0.0";

  // Aggregate CTA Clicks & Funnel
  const ctaClicks = events.filter((e) => e.eventType === "cta_click").length;
  const formViews = events.filter((e) => e.eventType === "form_viewed").length;
  const formStarts = events.filter((e) => e.eventType === "form_started").length;
  const totalRegistrations = applications.length;

  const visitorConversionRate =
    uniqueVisitors > 0
      ? ((totalRegistrations / uniqueVisitors) * 100).toFixed(1)
      : "0.0";

  const formCompletionRate =
    formStarts > 0 ? ((totalRegistrations / formStarts) * 100).toFixed(1) : "0.0";

  // Willingness to Pay breakdown
  const wtpCounts: Record<string, number> = {};
  WILLINGNESS_TO_PAY_OPTIONS.forEach((opt) => {
    wtpCounts[opt] = 0;
  });
  applications.forEach((app) => {
    const val = app.willingnessToPay || "Not sure yet";
    wtpCounts[val] = (wtpCounts[val] || 0) + 1;
  });

  // Traffic Source & UTM Breakdown
  const sourcesMap: Record<string, number> = {};
  applications.forEach((app) => {
    const src = app.utmSource || safeGetHostname(app.referrer);
    sourcesMap[src] = (sourcesMap[src] || 0) + 1;
  });
  const topSources = Object.entries(sourcesMap).sort((a, b) => b[1] - a[1]);

  // Volume & Channel Breakdown
  const channelCounts: Record<string, number> = {};
  applications.forEach((app) => {
    const c = app.channelsCount || "1 Channel";
    channelCounts[c] = (channelCounts[c] || 0) + 1;
  });

  return (
    <main className="min-h-screen bg-[#110e08] text-[#f7f3ee] p-4 sm:p-8 lg:p-10 font-sans">
      {/* Top Navbar */}
      <nav className="flex items-center justify-between pb-6 border-b border-[#2e281f]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#191610] border border-[#c8b29b]/40 flex items-center justify-center font-mono text-xs font-bold text-[#c8b29b]">
            SS
          </div>
          <div>
            <span className="font-semibold text-sm tracking-wider uppercase text-[#f7f3ee]">
              Serenity Studio
            </span>
            <span className="ml-2 font-mono text-xs text-[#c8b29b]">Launch Analytics &amp; Telemetry</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportCsvButton data={applications} />
          <form action={logout}>
            <button className="px-3 py-1.5 rounded-md border border-[#2e281f] bg-[#16130d] text-xs font-mono text-[#9c958c] hover:text-[#f7f3ee]">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      {/* Header & Date Filters */}
      <header className="py-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2e281f]/60 text-left">
        <div className="space-y-1">
          <p className="text-xs font-mono uppercase text-[#c8b29b] tracking-wider font-semibold">
            ORGANIC LAUNCH CONTROL
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f7f3ee]">
            Launch Telemetry &amp; Commercial Intent Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#9c958c]">
            End-to-end measurement: Traffic → Demo Plays → Funnels → Willingness to Pay.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#16130d] border border-[#2e281f] text-xs font-mono">
          {[
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "month", label: "This Month" },
            { id: "all", label: "All Time" },
          ].map((f) => (
            <Link
              key={f.id}
              href={`/admin?range=${f.id}`}
              className={`px-3 py-1.5 rounded-md transition-all ${
                range === f.id
                  ? "bg-[#c8b29b] text-[#110e08] font-bold"
                  : "text-[#9c958c] hover:text-[#f7f3ee]"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Section 1: Overview KPIs (8 Primary Metrics) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-8">
        {/* KPI 1: Visitors */}
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-[11px] font-mono uppercase">Unique Visitors</span>
            <Users className="w-4 h-4 text-[#c8b29b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#f7f3ee] mt-2">
            {uniqueVisitors}
          </div>
          <p className="text-[10px] text-[#736d64] mt-1 font-mono">
            {pageViews} page views · {uniqueSessions} sessions
          </p>
        </div>

        {/* KPI 2: Total Demo Plays */}
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-[11px] font-mono uppercase">Total Demo Plays</span>
            <Play className="w-4 h-4 text-[#4ade80]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#4ade80] mt-2">
            {videoPlays}
          </div>
          <p className="text-[10px] text-[#736d64] mt-1 font-mono">
            {videoImpressions} impressions in viewport
          </p>
        </div>

        {/* KPI 3: Video Completion Rate */}
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-[11px] font-mono uppercase">Video Completion</span>
            <CheckCircle2 className="w-4 h-4 text-[#c8b29b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#f7f3ee] mt-2">
            {videoCompletionRate}%
          </div>
          <p className="text-[10px] text-[#736d64] mt-1 font-mono">
            {video100} watched entire 1:52 demo
          </p>
        </div>

        {/* KPI 4: CTA Clicks */}
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-[11px] font-mono uppercase">Total CTA Clicks</span>
            <MousePointerClick className="w-4 h-4 text-[#c8b29b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#f7f3ee] mt-2">
            {ctaClicks}
          </div>
          <p className="text-[10px] text-[#736d64] mt-1 font-mono">
            Hero, Demo, &amp; Nav conversions
          </p>
        </div>

        {/* KPI 5: Registration Starts */}
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-[11px] font-mono uppercase">Form Starts</span>
            <Activity className="w-4 h-4 text-[#c8b29b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#f7f3ee] mt-2">
            {formStarts}
          </div>
          <p className="text-[10px] text-[#736d64] mt-1 font-mono">
            {formViews} reached registration section
          </p>
        </div>

        {/* KPI 6: Successful Registrations */}
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-[11px] font-mono uppercase">Total Registrations</span>
            <WalletCards className="w-4 h-4 text-[#4ade80]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#4ade80] mt-2">
            {totalRegistrations}
          </div>
          <p className="text-[10px] text-[#736d64] mt-1 font-mono">
            Early Access Interest Pool
          </p>
        </div>

        {/* KPI 7: Form Completion Rate */}
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-[11px] font-mono uppercase">Form Completion</span>
            <CheckCircle2 className="w-4 h-4 text-[#c8b29b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#f7f3ee] mt-2">
            {formCompletionRate}%
          </div>
          <p className="text-[10px] text-[#736d64] mt-1 font-mono">
            Starts to successful registration
          </p>
        </div>

        {/* KPI 8: Visitor-to-Registration Rate */}
        <div className="p-5 rounded-xl bg-[#16130d] border border-[#2e281f] text-left">
          <div className="flex items-center justify-between text-[#9c958c]">
            <span className="text-[11px] font-mono uppercase">Visitor Conversion</span>
            <BarChart3 className="w-4 h-4 text-[#c8b29b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#f7f3ee] mt-2">
            {visitorConversionRate}%
          </div>
          <p className="text-[10px] text-[#736d64] mt-1 font-mono">
            Unique visitors who registered
          </p>
        </div>
      </section>

      {/* Section 2: Funnels & Willingness to Pay Breakdown Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 text-left">
        {/* Left: Willingness to Pay Distribution */}
        <div className="lg:col-span-6 p-6 rounded-xl bg-[#16130d] border border-[#2e281f] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#2e281f]">
            <div>
              <span className="text-[11px] font-mono uppercase text-[#c8b29b] font-semibold tracking-wider">
                Commercial Demand Signal
              </span>
              <h2 className="text-base font-bold text-[#f7f3ee] mt-0.5">
                Willingness-to-Pay Distribution
              </h2>
            </div>
            <span className="text-xs font-mono text-[#9c958c]">
              {totalRegistrations} responses
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {WILLINGNESS_TO_PAY_OPTIONS.map((tier) => {
              const count = wtpCounts[tier] || 0;
              const percent =
                totalRegistrations > 0
                  ? Math.round((count / totalRegistrations) * 100)
                  : 0;

              return (
                <div key={tier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#eae1d7] font-medium">{tier}</span>
                    <span className="font-mono text-[#9c958c]">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#110e08] overflow-hidden border border-[#2e281f]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        tier.includes("90,000") || tier.includes("38,000") || tier.includes("23,000")
                          ? "bg-[#4ade80]"
                          : tier.includes("Only interested if free")
                          ? "bg-[#736d64]"
                          : "bg-[#c8b29b]"
                      }`}
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Funnels (Video Engagement & Registration Funnel) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Video Engagement Funnel */}
          <div className="p-6 rounded-xl bg-[#16130d] border border-[#2e281f] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2e281f]">
              <div>
                <span className="text-[11px] font-mono uppercase text-[#c8b29b] font-semibold tracking-wider">
                  Product Demo Funnel
                </span>
                <h2 className="text-base font-bold text-[#f7f3ee] mt-0.5">
                  1:52 Video Engagement Milestones
                </h2>
              </div>
              <span className="text-xs font-mono text-[#4ade80]">
                {videoPlays} Plays
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 text-center">
              {[
                { label: "25% (28s)", count: video25 },
                { label: "50% (56s)", count: video50 },
                { label: "75% (84s)", count: video75 },
                { label: "100% (112s)", count: video100 },
              ].map((m) => {
                const pct = videoPlays > 0 ? Math.round((m.count / videoPlays) * 100) : 0;
                return (
                  <div key={m.label} className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]">
                    <div className="text-[10px] font-mono text-[#9c958c]">{m.label}</div>
                    <div className="text-base font-bold text-[#f7f3ee] mt-1 font-mono">{m.count}</div>
                    <div className="text-[10px] font-mono text-[#c8b29b]">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Registration Conversion Funnel */}
          <div className="p-6 rounded-xl bg-[#16130d] border border-[#2e281f] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2e281f]">
              <div>
                <span className="text-[11px] font-mono uppercase text-[#c8b29b] font-semibold tracking-wider">
                  Acquisition Flow
                </span>
                <h2 className="text-base font-bold text-[#f7f3ee] mt-0.5">
                  Registration Conversion Funnel
                </h2>
              </div>
              <span className="text-xs font-mono text-[#c8b29b]">
                {visitorConversionRate}% CR
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 text-center">
              {[
                { label: "Unique Visitors", count: uniqueVisitors },
                { label: "Form Viewed", count: formViews },
                { label: "Form Started", count: formStarts },
                { label: "Registered", count: totalRegistrations },
              ].map((step, idx) => (
                <div key={step.label} className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]">
                  <div className="text-[10px] font-mono text-[#9c958c]">{step.label}</div>
                  <div className="text-base font-bold text-[#f7f3ee] mt-1 font-mono">{step.count}</div>
                  <div className="text-[10px] font-mono text-[#4ade80]">
                    {idx === 0 ? "100%" : uniqueVisitors > 0 ? `${Math.round((step.count / uniqueVisitors) * 100)}%` : "0%"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Traffic Sources & Volumes Breakdown */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-left">
        {/* Top Acquisition Sources */}
        <div className="p-6 rounded-xl bg-[#16130d] border border-[#2e281f] space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#2e281f]">
            <h3 className="text-sm font-bold text-[#f7f3ee] uppercase font-mono tracking-wider">
              Acquisition Sources / UTM Campaigns
            </h3>
            <span className="text-xs font-mono text-[#c8b29b]">Attribution</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {topSources.map(([src, count]) => (
              <div key={src} className="flex items-center justify-between text-xs py-1.5 px-3 rounded bg-[#110e08] border border-[#2e281f]/60">
                <span className="text-[#eae1d7] truncate max-w-[280px] font-mono">{src}</span>
                <span className="font-mono text-[#4ade80] font-semibold">{count} registrations</span>
              </div>
            ))}
            {topSources.length === 0 && (
              <div className="text-xs text-[#736d64] py-4 text-center">No attribution records captured in this date window.</div>
            )}
          </div>
        </div>

        {/* Channel Volume Breakdown */}
        <div className="p-6 rounded-xl bg-[#16130d] border border-[#2e281f] space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#2e281f]">
            <h3 className="text-sm font-bold text-[#f7f3ee] uppercase font-mono tracking-wider">
              Registrations by Channels Managed
            </h3>
            <span className="text-xs font-mono text-[#c8b29b]">Portfolio Size</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {["1 Channel", "2–3 Channels", "4–10 Channels", "10+ Channels"].map((c) => (
              <div key={c} className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]">
                <div className="text-[11px] font-mono text-[#9c958c]">{c}</div>
                <div className="text-xl font-bold font-mono text-[#f7f3ee] mt-1">
                  {channelCounts[c] || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Main Registrations Table */}
      <section className="rounded-xl bg-[#16130d] border border-[#2e281f] overflow-hidden text-left mb-8">
        <div className="p-4 border-b border-[#2e281f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#f7f3ee] uppercase tracking-wider font-mono">
              Registered Candidate Pipeline ({applications.length})
            </h2>
            <p className="text-xs text-[#9c958c]">
              Verified commercial intent and qualification responses.
            </p>
          </div>
          <div className="text-xs font-mono text-[#c8b29b]">
            Direct Database Telemetry
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2e281f] bg-[#110e08] text-[#9c958c]">
                <th className="py-3 px-4 text-left font-mono">Applicant</th>
                <th className="py-3 px-4 text-left font-mono">Channel URL</th>
                <th className="py-3 px-4 text-left font-mono">Willingness to Pay</th>
                <th className="py-3 px-4 text-left font-mono">Volume</th>
                <th className="py-3 px-4 text-left font-mono">Current Spend</th>
                <th className="py-3 px-4 text-left font-mono">Primary Bottleneck / Notes</th>
                <th className="py-3 px-4 text-left font-mono">Source</th>
                <th className="py-3 px-4 text-left font-mono">Date</th>
                <th className="py-3 px-4 text-right font-mono">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e281f]">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-[#191610]">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#f7f3ee]">{app.name}</div>
                    <div className="text-[#736d64] font-mono text-[11px]">{app.email}</div>
                  </td>
                  <td className="py-3 px-4 text-[#c8b29b] font-mono">
                    {(() => {
                      const raw = String(app.channelUrl || "").trim();
                      if (!raw) return <span className="text-[#736d64]">—</span>;
                      const match = raw.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|c\/|user\/|channel\/)?([^\/\s?#]+)/i);
                      const cleanTag = (match && match[1] ? match[1] : raw).replace(/^@+/, "");
                      if (!cleanTag) return <span className="text-[#736d64]">—</span>;
                      const redirectUrl = `https://youtube.com/@${cleanTag}`;
                      return (
                        <a
                          href={redirectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <Youtube className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />
                          <span className="truncate max-w-[140px]">@{cleanTag}</span>
                        </a>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        app.willingnessToPay?.includes("90,000") ||
                        app.willingnessToPay?.includes("38,000") ||
                        app.willingnessToPay?.includes("23,000")
                          ? "bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80]"
                          : app.willingnessToPay?.includes("Only interested if free")
                          ? "bg-[#736d64]/10 border border-[#736d64]/30 text-[#9c958c]"
                          : "bg-[#c8b29b]/10 border border-[#c8b29b]/30 text-[#c8b29b]"
                      }`}
                    >
                      {app.willingnessToPay || "Not specified"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#9c958c]">
                    <div>{app.channelsCount}</div>
                    <div className="text-[10px] text-[#736d64]">
                      {app.monthlyVideos} · {app.monthlyShorts || "0 Shorts"}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#eae1d7]">
                    {app.monthlySpend || "—"}
                  </td>
                  <td className="py-3 px-4 max-w-[220px] truncate text-[#eae1d7]" title={app.primaryProblem || app.notes || ""}>
                    {app.primaryProblem || app.notes || "—"}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[#736d64]">
                    {app.utmSource || (app.referrer ? "Referral" : "Direct")}
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
          {applications.length === 0 && (
            <div className="p-8 text-center text-xs text-[#736d64]">
              No registrations found for this date range.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
