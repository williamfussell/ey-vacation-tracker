"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Team, Member, PtoEntry, EditLogEntry } from "@/lib/types";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell,
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

function getReturnDate(endDate: string): string {
  const end = parseISO(endDate);
  const back = addDays(end, 1);
  const today = new Date();
  const diffDays = Math.ceil((back.getTime() - today.getTime()) / 86400000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return format(back, "EEEE");
  return format(back, "MMM d");
}

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ptoEntries, setPtoEntries] = useState<PtoEntry[]>([]);
  const [logs, setLogs] = useState<EditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Out today with return info
  const outToday = useMemo(() => {
    return ptoEntries
      .filter((e) => e.start_date <= today && e.end_date >= today)
      .map((e) => {
        const member = members.find((m) => m.id === e.member_id);
        const team = teams.find((t) => t.id === member?.team_id);
        const days = differenceInBusinessDays(addDays(parseISO(e.end_date), 1), parseISO(e.start_date));
        return {
          ...e, memberName: member?.name || "Unknown", teamName: team?.name || "",
          memberId: e.member_id, returnDate: getReturnDate(e.end_date), totalDays: days,
        };
      });
  }, [ptoEntries, members, teams, today]);

  // Out tomorrow with return info
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const outTomorrow = useMemo(() => {
    return ptoEntries
      .filter((e) => e.start_date <= tomorrow && e.end_date >= tomorrow)
      .map((e) => {
        const member = members.find((m) => m.id === e.member_id);
        const team = teams.find((t) => t.id === member?.team_id);
        const days = differenceInBusinessDays(addDays(parseISO(e.end_date), 1), parseISO(e.start_date));
        return {
          ...e, memberName: member?.name || "Unknown", teamName: team?.name || "",
          memberId: e.member_id, returnDate: getReturnDate(e.end_date), totalDays: days,
        };
      });
  }, [ptoEntries, members, teams, tomorrow]);

  // This week day-by-day
  const weekDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monday, end: addDays(monday, 4) });
    return days.map((d) => {
      const ds = format(d, "yyyy-MM-dd");
      const out = ptoEntries
        .filter((e) => e.start_date <= ds && e.end_date >= ds)
        .map((e) => {
          const m = members.find((x) => x.id === e.member_id);
          const t = teams.find((x) => x.id === m?.team_id);
          return { name: m?.name || "Unknown", team: t?.name || "" };
        });
      return { date: d, label: format(d, "EEE"), fullLabel: format(d, "EEEE, MMM d"), count: out.length, members: out, isToday: ds === today };
    });
  }, [ptoEntries, members, teams, monday, today]);

  // Team coverage today
  const teamCoverage = useMemo(() => {
    const outIds = new Set(outToday.map((e) => e.memberId));
    return teams.map((t) => {
      const tm = members.filter((m) => m.team_id === t.id);
      const available = tm.filter((m) => !outIds.has(m.id)).length;
      const outMembers = tm.filter((m) => outIds.has(m.id)).map((m) => m.name);
      return { name: t.name, total: tm.length, available, out: tm.length - available, outMembers };
    }).filter(t => t.total > 0);
  }, [teams, members, outToday]);

  // Upcoming risks — next 14 business days with 2+ people out
  const upcomingRisks = useMemo(() => {
    const start = addDays(new Date(), 1);
    const days = eachDayOfInterval({ start, end: addDays(start, 20) }).filter(d => !isWeekend(d));
    return days
      .map((d) => {
        const ds = format(d, "yyyy-MM-dd");
        const out = ptoEntries.filter((e) => e.start_date <= ds && e.end_date >= ds);
        const outByTeam = new Map<string, number>();
        out.forEach((e) => {
          const m = members.find((x) => x.id === e.member_id);
          const t = teams.find((x) => x.id === m?.team_id);
          const tn = t?.name || "Unknown";
          outByTeam.set(tn, (outByTeam.get(tn) || 0) + 1);
        });
        // Flag if any team has 50%+ out or total 3+ out
        const teamRisks = [...outByTeam.entries()].filter(([tn, cnt]) => {
          const total = members.filter((m) => m.team_id === teams.find(t => t.name === tn)?.id).length;
          return total > 0 && cnt / total >= 0.5;
        });
        return { date: format(d, "EEE, MMM d"), count: out.length, teamRisks, isRisky: out.length >= 3 || teamRisks.length > 0 };
      })
      .filter((d) => d.isRisky)
      .slice(0, 5);
  }, [ptoEntries, members, teams]);

  // 14-day forecast
  const next14Days = useMemo(() => {
    const start = new Date();
    return eachDayOfInterval({ start, end: addDays(start, 13) }).map((d) => {
      const ds = format(d, "yyyy-MM-dd");
      return { date: format(d, "EEE d"), count: ptoEntries.filter((e) => e.start_date <= ds && e.end_date >= ds).length, isWeekend: isWeekend(d) };
    });
  }, [ptoEntries]);

  // PTO by team
  const ptoByTeam = useMemo(() => {
    return teams.map((t) => {
      const ids = members.filter((m) => m.team_id === t.id).map((m) => m.id);
      const days = ptoEntries.filter((e) => ids.includes(e.member_id)).reduce((sum, e) => sum + differenceInBusinessDays(addDays(parseISO(e.end_date), 1), parseISO(e.start_date)), 0);
      return { name: t.name, days, color: TEAM_COLORS[t.name] || "#999" };
    });
  }, [teams, members, ptoEntries]);

  // Monthly PTO
  const monthlyPto = useMemo(() => {
    const result: { month: string; days: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const ms = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const me = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const msf = format(ms, "yyyy-MM-dd"), mef = format(me, "yyyy-MM-dd");
      const days = ptoEntries.filter((e) => e.start_date <= mef && e.end_date >= msf).reduce((sum, e) => {
        const s = parseISO(e.start_date < msf ? msf : e.start_date);
        const en = parseISO(e.end_date > mef ? mef : e.end_date);
        return sum + differenceInBusinessDays(addDays(en, 1), s);
      }, 0);
      result.push({ month: format(ms, "MMM"), days });
    }
    return result;
  }, [ptoEntries]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return format(d, "MMM d");
  };

  if (loading) {
    return (<div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>);
  }

  return (
    <div className="min-h-screen animate-fadeIn">
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
              <Link href="/dashboard" className="text-[11px] md:text-[12px] font-semibold text-[#111] px-2 md:px-3 py-1.5 rounded-md bg-black/[.04]">Dashboard</Link>
              <Link href="/" className="text-[11px] md:text-[12px] font-medium text-[#999] px-2 md:px-3 py-1.5 rounded-md hover:text-[#555] transition-colors">Calendar</Link>
              <Link href="/history" className="text-[11px] md:text-[12px] font-medium text-[#999] px-2 md:px-3 py-1.5 rounded-md hover:text-[#555] transition-colors">History</Link>
            </div>
          </div>
          <span className="text-[12px] text-[#999] hidden md:inline">{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
        </div>
      </header>

      <main className="max-w-[1520px] mx-auto px-4 md:px-8 pt-6 pb-12 animate-slideUp">

        {/* ── Row 1: Today + Tomorrow + This Week + Coverage ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">

          {/* Card 1: Today */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Today</span>
              <span className="text-[22px] font-extrabold leading-none" style={{ color: outToday.length === 0 ? '#10B981' : '#111' }}>
                {outToday.length === 0 ? '0' : outToday.length}
              </span>
            </div>
            {outToday.length === 0 ? (
              <div className="text-[12px] font-medium text-[#10B981]">Full team available</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {outToday.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: TEAM_COLORS[e.teamName] || '#999' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-medium text-[#333]">{e.memberName}</span>
                      <span className="text-[10px] text-[#CCC] ml-1">back {e.returnDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Tomorrow */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Tomorrow</span>
              <span className="text-[22px] font-extrabold leading-none" style={{ color: outTomorrow.length === 0 ? '#10B981' : '#111' }}>
                {outTomorrow.length === 0 ? '0' : outTomorrow.length}
              </span>
            </div>
            {outTomorrow.length === 0 ? (
              <div className="text-[12px] font-medium text-[#10B981]">Full team available</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {outTomorrow.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: TEAM_COLORS[e.teamName] || '#999' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-medium text-[#333]">{e.memberName}</span>
                      <span className="text-[10px] text-[#CCC] ml-1">{e.totalDays}d</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: This Week */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">This Week</span>
            <div className="mt-3 flex flex-col gap-2.5">
              {weekDays.map((wd, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold" style={{ color: wd.isToday ? '#111' : '#BBB' }}>
                      {wd.label}
                      {wd.isToday && <span className="text-[8px] font-bold text-[#F59E0B] ml-1">TODAY</span>}
                    </span>
                    {wd.count === 0 ? (
                      <span className="text-[10px] text-[#DDD]">—</span>
                    ) : (
                      <span className="text-[10px] font-bold" style={{ color: wd.count >= 3 ? '#dc2626' : wd.count >= 2 ? '#d97706' : '#999' }}>
                        {wd.count}
                      </span>
                    )}
                  </div>
                  {wd.count > 0 && (
                    <div className="flex flex-col gap-0.5 mt-1 ml-1 pl-2" style={{ borderLeft: '2px solid #f0f0f5' }}>
                      {wd.members.map((m, j) => (
                        <div key={j} className="flex items-center gap-1.5">
                          <span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{ background: TEAM_COLORS[m.team] || '#999' }} />
                          <span className="text-[10px] font-medium text-[#555]">{m.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Card 4: Team Coverage */}
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Team Coverage</span>
            <div className="mt-3 flex flex-col gap-3">
              {teamCoverage.map((t) => {
                const pct = Math.round((t.available / t.total) * 100);
                const color = TEAM_COLORS[t.name] || "#999";
                const isLow = pct < 50;
                return (
                  <div key={t.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-[5px] h-[5px] rounded-full" style={{ background: color }} />
                        <span className="text-[11px] font-semibold text-[#555]">{t.name}</span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: isLow ? '#dc2626' : '#333' }}>
                        {t.available}/{t.total}
                      </span>
                    </div>
                    <div className="h-[5px] bg-[#f0f0f5] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isLow ? '#dc2626' : color }} />
                    </div>
                    {t.out > 0 && (
                      <div className="text-[9px] text-[#CCC] mt-1">{t.outMembers.join(", ")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Row 2: 14-day chart + PTO by team ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-5">
          <div className="md:col-span-2 bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Next 14 Days</span>
            <div className="mt-4 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={next14Days}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#CCC' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#CCC' }} axisLine={false} tickLine={false} width={20} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 4px 12px rgba(0,0,0,.06)' }} formatter={(value) => [`${value} people`, 'Out']} labelFormatter={(label) => String(label)} />
                  <Area type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 2, fill: '#8B5CF6', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">PTO Days by Team</span>
            <div className="mt-4 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ptoByTeam} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#CCC' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,.08)' }} formatter={(value) => [`${value} days`, 'PTO']} />
                  <Bar dataKey="days" radius={[0, 6, 6, 0]} barSize={14}>
                    {ptoByTeam.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Row 3: Monthly + Activity ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">PTO Days by Month</span>
            <div className="mt-4 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPto}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#CCC' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#CCC' }} axisLine={false} tickLine={false} width={20} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,.08)' }} formatter={(value) => [`${value} days`, 'PTO']} />
                  <Bar dataKey="days" fill="#111" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-black/[.06] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.03)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Recent Activity</span>
            <div className="mt-3 flex flex-col">
              {logs.length === 0 ? (
                <span className="text-[12px] text-[#CCC] py-4 text-center">No activity yet</span>
              ) : (
                logs.slice(0, 7).map((log, i) => (
                  <div key={log.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < 6 ? '1px solid rgba(0,0,0,.03)' : 'none' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: log.action === "create" ? "#ecfdf5" : "#fef2f2" }}>
                      <span className="text-[10px]">{log.action === "create" ? "+" : "−"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-semibold text-[#222]">{log.target_member_name}</span>
                      <span className="text-[12px] text-[#999]"> {log.action === "create" ? "out" : "back"} </span>
                      <span className="text-[11px] text-[#CCC] font-mono">{log.start_date} → {log.end_date}</span>
                    </div>
                    <span className="text-[10px] text-[#CCC] flex-shrink-0">{formatTime(log.created_at)}</span>
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
