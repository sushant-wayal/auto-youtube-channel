"use client";

import { Download } from "lucide-react";

interface ApplicationExportData {
  name: string;
  email: string;
  channelUrl: string;
  willingnessToPay: string;
  channelsCount: string;
  monthlyVideos: string;
  monthlyShorts?: string | null;
  currentWorkflow: string;
  monthlySpend: string;
  primaryProblem?: string | null;
  notes?: string | null;
  selectedTier?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  createdAt: string | Date;
}

export default function ExportCsvButton({ data }: { data: ApplicationExportData[] }) {
  const handleExport = () => {
    if (!data.length) return;
    const headers = [
      "Name",
      "Email",
      "Channel URL",
      "Willingness to Pay",
      "Channels Count",
      "Monthly Videos",
      "Monthly Shorts",
      "Current Workflow",
      "Monthly Spend",
      "Primary Problem / Notes",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign",
      "Referrer",
      "Date",
    ];

    const rows = data.map((d) => [
      `"${(d.name || "").replace(/"/g, '""')}"`,
      `"${(d.email || "").replace(/"/g, '""')}"`,
      `"${(d.channelUrl || "").replace(/"/g, '""')}"`,
      `"${(d.willingnessToPay || "").replace(/"/g, '""')}"`,
      `"${(d.channelsCount || "").replace(/"/g, '""')}"`,
      `"${(d.monthlyVideos || "").replace(/"/g, '""')}"`,
      `"${(d.monthlyShorts || "").replace(/"/g, '""')}"`,
      `"${(d.currentWorkflow || "").replace(/"/g, '""')}"`,
      `"${(d.monthlySpend || "").replace(/"/g, '""')}"`,
      `"${(d.primaryProblem || d.notes || "").replace(/"/g, '""')}"`,
      `"${(d.utmSource || "").replace(/"/g, '""')}"`,
      `"${(d.utmMedium || "").replace(/"/g, '""')}"`,
      `"${(d.utmCampaign || "").replace(/"/g, '""')}"`,
      `"${(d.referrer || "").replace(/"/g, '""')}"`,
      `"${new Date(d.createdAt).toISOString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `serenity_early_access_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2e281f] bg-[#16130d] text-xs font-mono text-[#c8b29b] hover:bg-[#221e17] hover:border-[#c8b29b] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download className="w-3.5 h-3.5" />
      <span>Export CSV</span>
    </button>
  );
}
