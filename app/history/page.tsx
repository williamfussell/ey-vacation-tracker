"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EditLogEntry } from "@/lib/types";
import Link from "next/link";

export default function HistoryPage() {
  const [logs, setLogs] = useState<EditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    const { data } = await supabase.from("edit_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setLogs(data);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleUndo = async (log: EditLogEntry) => {
    if (log.action === "create" && log.pto_entry_id) {
      if (!window.confirm(`Undo PTO for ${log.target_member_name}?`)) return;
      await supabase.from("pto_entries").delete().eq("id", log.pto_entry_id);
      await supabase.from("edit_log").insert({ member_name: "System (undo)", target_member_name: log.target_member_name, action: "delete", start_date: log.start_date, end_date: log.end_date });
      fetchLogs();
    } else if (log.action === "delete") {
      if (!window.confirm(`Restore PTO for ${log.target_member_name}?`)) return;
      const { data: member } = await supabase.from("members").select("id").eq("name", log.target_member_name).single();
      if (member) {
        const { data: entry } = await supabase.from("pto_entries").insert({ member_id: member.id, start_date: log.start_date, end_date: log.end_date }).select().single();
        await supabase.from("edit_log").insert({ pto_entry_id: entry?.id, member_name: "System (undo)", target_member_name: log.target_member_name, action: "create", start_date: log.start_date, end_date: log.end_date });
        fetchLogs();
      }
    }
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen animate-fadeIn">
      <header className="border-b border-black/[.06]">
        <div className="max-w-4xl mx-auto px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <img src="/ey-logo.png" alt="EY" className="h-7 w-auto" />
              <span className="text-[14px] font-semibold text-[#111] tracking-tight">FlexiGenAI Team Tracker</span>
            </div>
            <div className="h-4 w-px bg-black/[.08]" />
            <div className="flex items-center gap-1">
              <Link href="/dashboard" className="text-[12px] font-medium text-[#999] px-3 py-1.5 rounded-md hover:text-[#555] transition-colors">Dashboard</Link>
              <Link href="/" className="text-[12px] font-medium text-[#999] px-3 py-1.5 rounded-md hover:text-[#555] transition-colors">Calendar</Link>
              <Link href="/history" className="text-[12px] font-semibold text-[#111] px-3 py-1.5 rounded-md bg-black/[.04]">History</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 pt-5 pb-8 animate-slideUp">
        {logs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-black/[.06]">
            <p className="text-[13px] font-medium text-[#999]">No edits yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-black/[.08] overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[.06]">
                  {["When", "Action", "By", "For", "Dates", ""].map((h, i) => (
                    <th key={i} className={`px-5 py-3 text-[9px] font-semibold uppercase tracking-widest text-[#BBB] bg-[#FAFBFD] ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} className="border-b border-black/[.03] transition-colors hover:bg-[#FAFBFD]">
                    <td className="px-5 py-3 text-[12px] text-[#BBB]">{formatTime(log.created_at)}</td>
                    <td className="px-5 py-3"><span className={`tag ${log.action === "create" ? "tag-added" : "tag-removed"}`}>{log.action === "create" ? "Added" : "Removed"}</span></td>
                    <td className="px-5 py-3 text-[12px] text-[#888]">{log.member_name}</td>
                    <td className="px-5 py-3 text-[13px] font-semibold text-[#111]">{log.target_member_name}</td>
                    <td className="px-5 py-3 text-[12px] text-[#888] font-mono">{log.start_date} <span className="text-[#DDD]">&rarr;</span> {log.end_date}</td>
                    <td className="px-5 py-3 text-right"><button onClick={() => handleUndo(log)} className="btn btn-ghost text-[11px]">Undo</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
