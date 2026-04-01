"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Team, Member, PtoEntry } from "@/lib/types";
import PtoGrid from "@/components/PtoGrid";
import MobileCalendar from "@/components/MobileCalendar";
import Link from "next/link";

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ptoEntries, setPtoEntries] = useState<PtoEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [teamsRes, membersRes, ptoRes] = await Promise.all([
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("members").select("*"),
      supabase.from("pto_entries").select("*"),
    ]);
    if (teamsRes.data) setTeams(teamsRes.data);
    if (membersRes.data) setMembers(membersRes.data);
    if (ptoRes.data) setPtoEntries(ptoRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ptoChan = supabase.channel("pto-changes").on("postgres_changes", { event: "*", schema: "public", table: "pto_entries" }, () => fetchData()).subscribe();
    const memberChan = supabase.channel("member-changes").on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(ptoChan); supabase.removeChannel(memberChan); };
  }, [fetchData]);

  const today = new Date().toISOString().split("T")[0];
  const outToday = ptoEntries.filter((e) => e.start_date <= today && e.end_date >= today);
  const outTodayMembers = members.filter((m) => outToday.some((e) => e.member_id === m.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen animate-fadeIn">
      {/* Header */}
      <header className="border-b border-black/[.06]">
        <div className="max-w-[1520px] mx-auto px-4 md:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="flex items-center gap-2">
              <img src="/ey-logo.png" alt="EY" className="h-6 md:h-7 w-auto" />
              <span className="text-[13px] md:text-[14px] font-semibold text-[#111] tracking-tight hidden sm:inline">FlexiGenAI Team Tracker</span>
              <span className="text-[13px] font-semibold text-[#111] tracking-tight sm:hidden">FlexiGenAI</span>
            </div>

            <div className="h-4 w-px bg-black/[.08] hidden md:block" />

            <div className="flex items-center gap-0.5 md:gap-1">
              <Link href="/dashboard" className="text-[11px] md:text-[12px] font-medium text-[#999] px-2 md:px-3 py-1.5 rounded-md hover:text-[#555] transition-colors">Dashboard</Link>
              <Link href="/" className="text-[11px] md:text-[12px] font-semibold text-[#111] px-2 md:px-3 py-1.5 rounded-md bg-black/[.04]">Calendar</Link>
              <Link href="/history" className="text-[11px] md:text-[12px] font-medium text-[#999] px-2 md:px-3 py-1.5 rounded-md hover:text-[#555] transition-colors">History</Link>
            </div>

          </div>

          <span className="text-[11px] md:text-[12px] font-medium text-[#999] hidden sm:inline">
            {outTodayMembers.length > 0 ? (
              <>
                <span className="text-[#111] font-semibold">{outTodayMembers.length}</span> out today
              </>
            ) : (
              <span className="text-[#10B981]">Full team</span>
            )}
          </span>
        </div>
      </header>

      {/* Desktop: grid */}
      <main className="hidden md:block max-w-[1520px] mx-auto px-8 pt-5 pb-8 animate-slideUp">
        <PtoGrid
          teams={teams}
          members={members}
          ptoEntries={ptoEntries}
          onDataChange={fetchData}
          onMemberAdded={fetchData}
        />
      </main>

      {/* Mobile: list view */}
      <main className="md:hidden px-4 pt-4 pb-8 animate-slideUp">
        <MobileCalendar
          teams={teams}
          members={members}
          ptoEntries={ptoEntries}
          onDataChange={fetchData}
          onMemberAdded={fetchData}
        />
      </main>
    </div>
  );
}
