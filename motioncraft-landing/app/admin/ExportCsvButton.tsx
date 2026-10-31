"use client";

import { Download } from "lucide-react";

interface ApplicationExportData {
  name: string;
  email: string;
  channelUrl: string;
  channelsCount: string;
  monthlyVideos: string;
  currentWorkflow: string;
  monthlySpend: string;
  willingnessToPay: string;
  selectedTier?: string;
  notes?: string | null;
  utmSource?: string | null;
  createdAt: string | Date;
}

export default function ExportCsvButton({ data }: { data: ApplicationExportData[] }) {
  const handleExport = () => {
    if (!data.length) return;
    const headers = [
      "Name",
      "Email",
      "Channel URL",
      "Channels Count",
      "Monthly Videos",
      "Current Workflow",
      "Monthly Spend",
      "Willingness to Pay",
      "Selected Tier",
      "Notes",
      "UTM Source",
      "Date",
    ];

    const rows = data.map((d) => [
      `"${(d.name || "").replace(/"/g, '""')}"`,
      `"${(d.email || "").replace(/"/g, '""')}"`,
      `"${(d.channelUrl || "").replace(/"/g, '""')}"`,
      `"${(d.channelsCount || "").replace(/"/g, '""')}"`,
      `"${(d.monthlyVideos || "").replace(/"/g, '""')}"`,
      `"${(d.currentWorkflow || "").replace(/"/g, '""')}"`,
      `"${(d.monthlySpend || "").replace(/"/g, '""')}"`,
      `"${(d.willingnessToPay || "").replace(/"/g, '""')}"`,
      `"${(d.selectedTier || "").replace(/"/g, '""')}"`,
      `"${(d.notes || "").replace(/"/g, '""')}"`,
      `"${(d.utmSource || "").replace(/"/g, '""')}"`,
      `"${new Date(d.createdAt).toISOString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `serenity_founding_creators_${new Date().toISOString().slice(0, 10)}.csv`);
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

