"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Team, Member, PtoEntry, EditLogEntry } from "@/lib/types";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import { format, addDays, startOfWeek, eachDayOfInterval, isWeekend, differenceInBusinessDays, parseISO } from "date-fns";

const TEAM_COLORS: Record<string, string> = {
  "PM & Design": "#8B5CF6",
  Backend: "#3B82F6",
  Frontend: "#F59E0B",
  DevOps: "#10B981",
  Testing: "#F43F5E",
};

const CHART_COLORS = ["#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#F43F5E"];

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ptoEntries, setPtoEntries] = useState<PtoEntry[]>([]);
  const [logs, setLogs] = useState<EditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandToday, setExpandToday] = useState(false);
  const [expandWeek, setExpandWeek] = useState(false);

  const fetchData = useCallback(async () => {
    const [teamsRes, membersRes, ptoRes, logsRes] = await Promise.all([
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("members").select("*"),
      supabase.from("pto_entries").select("*"),
      supabase.from("edit_log").select("*").order("created_at", { ascending: false }).limit(10),
    ]);
    if (teamsRes.data) setTeams(teamsRes.data);
    if (membersRes.data) setMembers(membersRes.data);
    if (ptoRes.data) setPtoEntries(ptoRes.data);
    if (logsRes.data) setLogs(logsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = format(new Date(), "yyyy-MM-dd");
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Out today — with details
  const outToday = useMemo(() => {
    const todayEntries = ptoEntries.filter((e) => e.start_date <= today && e.end_date >= today);
    return todayEntries.map((e) => {
      const member = members.find((m) => m.id === e.member_id);
      const team = teams.find((t) => t.id === member?.team_id);
      return { ...e, memberName: member?.name || "Unknown", teamName: team?.name || "", memberId: e.member_id };
    });
  }, [ptoEntries, members, teams, today]);

  // Out this week — with details
  const outThisWeek = useMemo(() => {
    const fri = format(addDays(monday, 4), "yyyy-MM-dd");
    const mon = format(monday, "yyyy-MM-dd");
    const weekEntries = ptoEntries.filter((e) => e.start_date <= fri && e.end_date >= mon);
    const seen = new Set<string>();
    return weekEntries.filter((e) => {
      if (seen.has(e.member_id)) return false;
      seen.add(e.member_id);
      return true;
    }).map((e) => {
      const member = members.find((m) => m.id === e.member_id);
      const team = teams.find((t) => t.id === member?.team_id);
      return { ...e, memberName: member?.name || "Unknown", teamName: team?.name || "", memberId: e.member_id };
    });
  }, [ptoEntries, members, teams, monday]);

  // Team availability today
  const teamAvailability = useMemo(() => {
    const outIds = outToday.map((e) => e.memberId);
    return teams.map((t) => {
      const teamMembers = members.filter((m) => m.team_id === t.id);
      const available = teamMembers.filter((m) => !outIds.includes(m.id)).length;
      return { name: t.name, total: teamMembers.length, available, out: teamMembers.length - available };
    });
  }, [teams, members, outToday]);

  // Next 14 days — people out per day
  const next14Days = useMemo(() => {
    const start = new Date();
    const days = eachDayOfInterval({ start, end: addDays(start, 13) });
    return days.map((d) => {
      const ds = format(d, "yyyy-MM-dd");
      const count = ptoEntries.filter((e) => e.start_date <= ds && e.end_date >= ds).length;
      return {
        date: format(d, "EEE d"),
        full: format(d, "MMM d"),
        count,
        isWeekend: isWeekend(d),
      };
    });
  }, [ptoEntries]);

  // Overlap warnings — days in next 30 days with 3+ people out
  const overlapWarnings = useMemo(() => {
    const start = new Date();
    const days = eachDayOfInterval({ start, end: addDays(start, 29) });
    return days
      .map((d) => {
        const ds = format(d, "yyyy-MM-dd");
        const outMembers = ptoEntries
          .filter((e) => e.start_date <= ds && e.end_date >= ds)
          .map((e) => members.find((m) => m.id === e.member_id)?.name || "Unknown");
        return { date: format(d, "EEE, MMM d"), count: outMembers.length, names: outMembers, isWeekend: isWeekend(d) };
      })
      .filter((d) => d.count >= 3 && !d.isWeekend);
  }, [ptoEntries, members]);

  // PTO days by team (total business days)
  const ptoByTeam = useMemo(() => {
    return teams.map((t) => {
      const teamMemberIds = members.filter((m) => m.team_id === t.id).map((m) => m.id);
      const totalDays = ptoEntries
        .filter((e) => teamMemberIds.includes(e.member_id))
        .reduce((sum, e) => {
          const start = parseISO(e.start_date);
          const end = parseISO(e.end_date);
          return sum + differenceInBusinessDays(addDays(end, 1), start);
        }, 0);
      return { name: t.name, days: totalDays, color: TEAM_COLORS[t.name] || "#999" };
    });
  }, [teams, members, ptoEntries]);

  // Monthly PTO heatmap — next 6 months
  const monthlyPto = useMemo(() => {
    const result: { month: string; days: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const ms = format(monthStart, "yyyy-MM-dd");
      const me = format(monthEnd, "yyyy-MM-dd");
      const days = ptoEntries
        .filter((e) => e.start_date <= me && e.end_date >= ms)
        .reduce((sum, e) => {
          const s = parseISO(e.start_date < ms ? ms : e.start_date);
          const en = parseISO(e.end_date > me ? me : e.end_date);
          return sum + differenceInBusinessDays(addDays(en, 1), s);
        }, 0);
      result.push({ month: format(monthStart, "MMM"), days });
    }
    return result;
  }, [ptoEntries]);

  // Top PTO users
  const topUsers = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of ptoEntries) {
      const start = parseISO(e.start_date);
      const end = parseISO(e.end_date);
      const days = differenceInBusinessDays(addDays(end, 1), start);
      map.set(e.member_id, (map.get(e.member_id) || 0) + days);
    }
    return [...map.entries()]
      .map(([id, days]) => ({ name: members.find((m) => m.id === id)?.name || "Unknown", days }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 8);
  }, [ptoEntries, members]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return format(d, "MMM d");
  };

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
        <div className="max-w-[1520px] mx-auto px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <img src="/ey-logo.png" alt="EY" className="h-7 w-auto" />
              <span className="text-[14px] font-semibold text-[#111] tracking-tight">FlexiGenAI Team Tracker</span>
            </div>
            <div className="h-4 w-px bg-black/[.08]" />
            <div className="flex items-center gap-1">
              <Link href="/dashboard" className="text-[12px] font-semibold text-[#111] px-3 py-1.5 rounded-md bg-black/[.04]">Dashboard</Link>
              <Link href="/" className="text-[12px] font-medium text-[#999] px-3 py-1.5 rounded-md hover:text-[#555] transition-colors">Calendar</Link>
              <Link href="/history" className="text-[12px] font-medium text-[#999] px-3 py-1.5 rounded-md hover:text-[#555] transition-colors">History</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1520px] mx-auto px-8 pt-6 pb-12 animate-slideUp">
        {/* Status cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Out today */}
          <div
            className="bg-white rounded-xl border border-black/[.06] p-5 cursor-pointer transition-all hover:border-black/[.12]"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}
            onClick={() => outToday.length > 0 && setExpandToday(!expandToday)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Out Today</span>
                {outToday.length > 0 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#BBB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="transition-transform" style={{ transform: expandToday ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>
              <span className="text-[22px] font-bold text-[#111]">{outToday.length}</span>
            </div>
            {outToday.length > 0 ? (
              expandToday ? (
                <div className="flex flex-col gap-2 animate-fadeIn">
                  {outToday.map((e) => (
                    <div key={e.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: TEAM_COLORS[e.teamName] || '#999' }} />
                        <span className="text-[12px] font-medium text-[#333]">{e.memberName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#BBB]">{e.start_date} → {e.end_date}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {outToday.map((e) => (
                    <span key={e.id} className="text-[11px] font-medium text-[#666] bg-[#F3F3F8] px-2 py-0.5 rounded-full">
                      {e.memberName.split(" ")[0]}
                    </span>
                  ))}
                </div>
              )
            ) : (
              <span className="text-[12px] text-[#10B981] font-medium">Full team available</span>
            )}
          </div>

          {/* Out this week */}
          <div
            className="bg-white rounded-xl border border-black/[.06] p-5 cursor-pointer transition-all hover:border-black/[.12]"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}
            onClick={() => outThisWeek.length > 0 && setExpandWeek(!expandWeek)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Out This Week</span>
                {outThisWeek.length > 0 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#BBB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="transition-transform" style={{ transform: expandWeek ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>
              <span className="text-[22px] font-bold text-[#111]">{outThisWeek.length}</span>
            </div>
            {outThisWeek.length > 0 ? (
              expandWeek ? (
                <div className="flex flex-col gap-2 animate-fadeIn">
                  {outThisWeek.map((e) => (
                    <div key={e.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: TEAM_COLORS[e.teamName] || '#999' }} />
                        <span className="text-[12px] font-medium text-[#333]">{e.memberName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#BBB]">{e.start_date} → {e.end_date}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {outThisWeek.slice(0, 6).map((e) => (
                    <span key={e.id} className="text-[11px] font-medium text-[#666] bg-[#F3F3F8] px-2 py-0.5 rounded-full">
                      {e.memberName.split(" ")[0]}
                    </span>
                  ))}
                  {outThisWeek.length > 6 && (
                    <span className="text-[11px] font-medium text-[#999]">+{outThisWeek.length - 6} more</span>
                  )}
                </div>
              )
            ) : (
              <span className="text-[12px] text-[#10B981] font-medium">No one out this week</span>
            )}
          </div>

          {/* Total members */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Team Size</span>
              <span className="text-[22px] font-bold text-[#111]">{members.length}</span>
            </div>
            <div className="flex gap-3">
              {teams.map((t) => {
                const count = members.filter((m) => m.team_id === t.id).length;
                if (count === 0) return null;
                return (
                  <div key={t.id} className="flex items-center gap-1">
                    <span className="w-[6px] h-[6px] rounded-full" style={{ background: TEAM_COLORS[t.name] }} />
                    <span className="text-[11px] font-medium text-[#888]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overlap warnings */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Overlap Alerts</span>
              <span className="text-[22px] font-bold" style={{ color: overlapWarnings.length > 0 ? '#DC2626' : '#10B981' }}>
                {overlapWarnings.length}
              </span>
            </div>
            {overlapWarnings.length > 0 ? (
              <div className="text-[11px] text-[#888]">
                {overlapWarnings.slice(0, 2).map((w, i) => (
                  <div key={i}><span className="font-semibold text-[#DC2626]">{w.count}</span> out on {w.date}</div>
                ))}
                {overlapWarnings.length > 2 && <div className="text-[#BBB]">+{overlapWarnings.length - 2} more days</div>}
              </div>
            ) : (
              <span className="text-[12px] text-[#10B981] font-medium">No overlap issues</span>
            )}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* 14-day forecast */}
          <div className="col-span-2 bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Next 14 Days — People Out</span>
            <div className="mt-4 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={next14Days}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#BBB' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#BBB' }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                    formatter={(value) => [`${value} people`, 'Out']}
                    labelFormatter={(label) => String(label)}
                  />
                  <Area type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} fill="url(#areaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Team availability pie */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Team Availability Today</span>
            <div className="mt-2 h-[200px] flex items-center">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={teamAvailability}
                      dataKey="available"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {teamAvailability.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,.08)' }}
                      formatter={(value, name) => [`${value} available`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 flex flex-col gap-2">
                {teamAvailability.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-[#888] truncate">{t.name}</div>
                      <div className="text-[12px] font-semibold text-[#333]">{t.available}/{t.total}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-3 gap-4">
          {/* PTO by team bar chart */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Total PTO Days by Team</span>
            <div className="mt-4 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ptoByTeam} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#BBB' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,.08)' }}
                    formatter={(value) => [`${value} days`, 'PTO']}
                  />
                  <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                    {ptoByTeam.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly forecast */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">PTO Days by Month</span>
            <div className="mt-4 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPto}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#BBB' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#BBB' }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,.08)' }}
                    formatter={(value) => [`${value} days`, 'PTO']}
                  />
                  <Bar dataKey="days" fill="#111" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Recent Activity</span>
            <div className="mt-3 flex flex-col gap-2.5">
              {logs.length === 0 ? (
                <span className="text-[12px] text-[#BBB]">No activity yet</span>
              ) : (
                logs.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <div
                      className="w-[6px] h-[6px] rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: log.action === "create" ? "#10B981" : "#DC2626" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] text-[#444]">
                        <span className="font-semibold text-[#111]">{log.target_member_name}</span>
                        {" "}{log.action === "create" ? "added" : "removed"} PTO
                      </div>
                      <div className="text-[10px] text-[#BBB]">{log.start_date} → {log.end_date} · {formatTime(log.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
