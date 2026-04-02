import { createClient } from "@supabase/supabase-js";
import { format, addDays, startOfWeek, parseISO } from "date-fns";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface MemberWithTeam {
  id: string;
  name: string;
  team_name: string;
}

interface PtoWithMember {
  member_id: string;
  start_date: string;
  end_date: string;
}

const TEAM_COLORS: Record<string, string> = {
  "PM & Design": "#8B5CF6",
  Backend: "#3B82F6",
  Frontend: "#F59E0B",
  DevOps: "#10B981",
  Testing: "#F43F5E",
};

export interface OutMemberWithReturn {
  name: string;
  team_name: string;
  returnDate: string;
}

function getReturnLabel(endDate: string): string {
  const end = parseISO(endDate);
  const back = addDays(end, 1);
  const diffDays = Math.ceil((back.getTime() - Date.now()) / 86400000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return format(back, "EEEE");
  return format(back, "MMM d");
}

export async function getOutForDate(date: string): Promise<OutMemberWithReturn[]> {
  const supabase = getSupabase();

  const { data: ptoEntries } = await supabase
    .from("pto_entries")
    .select("member_id, start_date, end_date")
    .lte("start_date", date)
    .gte("end_date", date);

  if (!ptoEntries || ptoEntries.length === 0) return [];

  const memberIds = ptoEntries.map((e: PtoWithMember) => e.member_id);
  const { data: members } = await supabase.from("members").select("id, name, team_id").in("id", memberIds);
  const { data: teams } = await supabase.from("teams").select("id, name");

  if (!members || !teams) return [];

  const teamMap = new Map(teams.map((t: { id: string; name: string }) => [t.id, t.name]));

  return ptoEntries.map((e: PtoWithMember) => {
    const m = members.find((x: { id: string }) => x.id === e.member_id);
    return {
      name: m?.name || "Unknown",
      team_name: teamMap.get((m as { id: string; name: string; team_id: string })?.team_id) || "Unknown",
      returnDate: getReturnLabel(e.end_date),
    };
  });
}

export async function getOutToday(): Promise<MemberWithTeam[]> {
  const supabase = getSupabase();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: ptoEntries } = await supabase
    .from("pto_entries")
    .select("member_id, start_date, end_date")
    .lte("start_date", today)
    .gte("end_date", today);

  if (!ptoEntries || ptoEntries.length === 0) return [];

  const memberIds = ptoEntries.map((e: PtoWithMember) => e.member_id);
  const { data: members } = await supabase.from("members").select("id, name, team_id").in("id", memberIds);
  const { data: teams } = await supabase.from("teams").select("id, name");

  if (!members || !teams) return [];

  const teamMap = new Map(teams.map((t: { id: string; name: string }) => [t.id, t.name]));

  return members.map((m: { id: string; name: string; team_id: string }) => ({
    id: m.id,
    name: m.name,
    team_name: teamMap.get(m.team_id) || "Unknown",
  }));
}

export async function getWeekSummary(): Promise<Map<string, MemberWithTeam[]>> {
  const supabase = getSupabase();
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);

  const { data: ptoEntries } = await supabase
    .from("pto_entries")
    .select("member_id, start_date, end_date")
    .lte("start_date", format(friday, "yyyy-MM-dd"))
    .gte("end_date", format(monday, "yyyy-MM-dd"));

  if (!ptoEntries || ptoEntries.length === 0) return new Map();

  const memberIds = [...new Set(ptoEntries.map((e: PtoWithMember) => e.member_id))];
  const { data: members } = await supabase.from("members").select("id, name, team_id").in("id", memberIds);
  const { data: teams } = await supabase.from("teams").select("id, name");

  if (!members || !teams) return new Map();

  const teamMap = new Map(teams.map((t: { id: string; name: string }) => [t.id, t.name]));
  const memberMap = new Map(
    members.map((m: { id: string; name: string; team_id: string }) => [
      m.id,
      { id: m.id, name: m.name, team_name: teamMap.get(m.team_id) || "Unknown" },
    ])
  );

  const result = new Map<string, MemberWithTeam[]>();

  for (let i = 0; i < 5; i++) {
    const day = addDays(monday, i);
    const dayStr = format(day, "yyyy-MM-dd");
    const dayLabel = format(day, "EEEE, MMM d");

    const outThisDay = ptoEntries
      .filter((e: PtoWithMember) => e.start_date <= dayStr && e.end_date >= dayStr)
      .map((e: PtoWithMember) => memberMap.get(e.member_id))
      .filter(Boolean) as MemberWithTeam[];

    if (outThisDay.length > 0) {
      result.set(dayLabel, outThisDay);
    }
  }

  return result;
}

export async function getTotalMembers(): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase.from("members").select("id");
  return data?.length || 0;
}

export interface TeamAvailability {
  name: string;
  total: number;
  available: number;
  out: number;
}

export async function getTeamAvailability(): Promise<TeamAvailability[]> {
  const supabase = getSupabase();
  const today = format(new Date(), "yyyy-MM-dd");

  const [{ data: teams }, { data: members }, { data: pto }] = await Promise.all([
    supabase.from("teams").select("id, name").order("sort_order"),
    supabase.from("members").select("id, team_id"),
    supabase.from("pto_entries").select("member_id").lte("start_date", today).gte("end_date", today),
  ]);

  if (!teams || !members) return [];
  const outIds = new Set((pto || []).map((e: { member_id: string }) => e.member_id));

  return teams.map((t: { id: string; name: string }) => {
    const teamMembers = members.filter((m: { id: string; team_id: string }) => m.team_id === t.id);
    const available = teamMembers.filter((m: { id: string }) => !outIds.has(m.id)).length;
    return { name: t.name, total: teamMembers.length, available, out: teamMembers.length - available };
  });
}

export async function getNext5DaysOutCount(): Promise<{ day: string; short: string; count: number }[]> {
  const supabase = getSupabase();
  const result: { day: string; short: string; count: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const d = addDays(new Date(), i);
    const ds = format(d, "yyyy-MM-dd");
    const { data } = await supabase.from("pto_entries").select("id").lte("start_date", ds).gte("end_date", ds);
    result.push({ day: format(d, "EEEE"), short: format(d, "EEE d"), count: data?.length || 0 });
  }
  return result;
}

// ── Email HTML formatters ──

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ey-vacation-tracker.vercel.app";

function teamDot(teamName: string): string {
  const color = TEAM_COLORS[teamName] || "#999";
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>`;
}

function availabilityBar(available: number, total: number, color: string): string {
  const pct = total > 0 ? Math.round((available / total) * 100) : 100;
  return `<div style="background:#f0f0f5;border-radius:6px;height:8px;width:100%;overflow:hidden;">
    <div style="background:${color};height:100%;width:${pct}%;border-radius:6px;transition:width 0.3s;"></div>
  </div>`;
}

function countBadge(count: number): string {
  const bg = count === 0 ? "#ecfdf5" : count <= 2 ? "#fef3c7" : "#fef2f2";
  const color = count === 0 ? "#059669" : count <= 2 ? "#d97706" : "#dc2626";
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:800;padding:2px 10px;border-radius:20px;min-width:20px;text-align:center;">${count}</span>`;
}

function emailWrapper(badge: string, title: string, content: string): string {
  return `
<div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e8e8ee;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#111 0%,#222 100%);padding:28px 28px 24px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,.4);margin-bottom:6px;">${badge}</div>
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;">${title}</div>
  </div>
  <div style="padding:24px 28px;">${content}</div>
  <div style="padding:20px 28px;background:#fafafd;border-top:1px solid #f0f0f5;">
    <a href="${appUrl}/dashboard" style="display:inline-block;background:#111;color:#fff;padding:10px 24px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;">Open Dashboard</a>
    <a href="${appUrl}" style="display:inline-block;color:#888;padding:10px 16px;text-decoration:none;font-size:13px;font-weight:500;">View Calendar</a>
  </div>
</div>`;
}

export function formatDailyEmailHtml(
  outToday: MemberWithTeam[],
  totalMembers: number,
  teamAvailability?: TeamAvailability[],
  next5Days?: { day: string; short: string; count: number }[]
): string {
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  let content = "";

  // Summary stat
  if (outToday.length === 0) {
    content += `
      <div style="background:#ecfdf5;border-radius:14px;padding:24px;text-align:center;margin-bottom:20px;">
        <div style="font-size:32px;margin-bottom:6px;">&#9989;</div>
        <div style="font-size:16px;font-weight:700;color:#059669;">Full team available</div>
        <div style="font-size:13px;color:#10b981;margin-top:4px;">All ${totalMembers} members are in today</div>
      </div>`;
  } else {
    content += `
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="background:#f8f8fa;border-radius:14px;padding:20px;text-align:center;width:50%;">
            <div style="font-size:36px;font-weight:800;color:#111;">${outToday.length}</div>
            <div style="font-size:12px;font-weight:600;color:#999;margin-top:2px;">OUT TODAY</div>
          </td>
          <td style="width:12px;"></td>
          <td style="background:#f8f8fa;border-radius:14px;padding:20px;text-align:center;width:50%;">
            <div style="font-size:36px;font-weight:800;color:#10b981;">${totalMembers - outToday.length}</div>
            <div style="font-size:12px;font-weight:600;color:#999;margin-top:2px;">AVAILABLE</div>
          </td>
        </tr>
      </table>`;

    // People out grouped by team
    const grouped = new Map<string, MemberWithTeam[]>();
    for (const m of outToday) {
      const list = grouped.get(m.team_name) || [];
      list.push(m);
      grouped.set(m.team_name, list);
    }

    content += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#999;margin-bottom:12px;">Who's Out</div>`;
    for (const [team, members] of grouped) {
      const color = TEAM_COLORS[team] || "#999";
      content += `
        <div style="margin-bottom:12px;padding:14px 16px;background:#fafafd;border-radius:12px;border-left:3px solid ${color};">
          <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">${team}</div>
          ${members.map(m => `<div style="font-size:14px;font-weight:500;color:#333;padding:3px 0;">&#8226; ${m.name}</div>`).join("")}
        </div>`;
    }
  }

  // Team availability bars
  if (teamAvailability && teamAvailability.length > 0) {
    content += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#999;margin:24px 0 12px;">Team Availability</div>`;
    content += `<table style="width:100%;border-collapse:collapse;">`;
    for (const t of teamAvailability) {
      if (t.total === 0) continue;
      const color = TEAM_COLORS[t.name] || "#999";
      content += `
        <tr>
          <td style="padding:6px 0;width:90px;">
            <span style="font-size:12px;font-weight:600;color:#555;">${teamDot(t.name)}${t.name}</span>
          </td>
          <td style="padding:6px 8px;">${availabilityBar(t.available, t.total, color)}</td>
          <td style="padding:6px 0;width:55px;text-align:right;">
            <span style="font-size:12px;font-weight:700;color:#333;">${t.available}/${t.total}</span>
          </td>
        </tr>`;
    }
    content += `</table>`;
  }

  // Next 5 days preview
  if (next5Days && next5Days.length > 0) {
    content += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#999;margin:24px 0 12px;">Next 5 Days</div>`;
    content += `<table style="width:100%;border-collapse:collapse;">
      <tr>
        ${next5Days.map(d => `<td style="text-align:center;padding:8px 4px;background:#fafafd;border-radius:10px;">
          <div style="font-size:10px;font-weight:600;color:#999;">${d.short}</div>
          <div style="margin-top:6px;">${countBadge(d.count)}</div>
        </td>`).join('<td style="width:6px;"></td>')}
      </tr>
    </table>`;
  }

  return emailWrapper("Daily Update", today, content);
}

export function formatWeeklyEmailHtml(
  weekSummary: Map<string, MemberWithTeam[]>,
  totalMembers: number,
  teamAvailability?: TeamAvailability[]
): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "MMM d")} – ${format(friday, "MMM d, yyyy")}`;
  let content = "";

  if (weekSummary.size === 0) {
    content += `
      <div style="background:#ecfdf5;border-radius:14px;padding:24px;text-align:center;margin-bottom:20px;">
        <div style="font-size:32px;margin-bottom:6px;">&#9989;</div>
        <div style="font-size:16px;font-weight:700;color:#059669;">No one is out this week</div>
        <div style="font-size:13px;color:#10b981;margin-top:4px;">Full team of ${totalMembers} available</div>
      </div>`;
  } else {
    // Day-by-day table
    content += `<table style="width:100%;border-collapse:separate;border-spacing:0 4px;">`;
    for (const [day, members] of weekSummary) {
      const count = members.length;
      const barColor = count >= 3 ? "#fef2f2" : count >= 2 ? "#fefce8" : "#fafafd";
      const borderColor = count >= 3 ? "#fca5a5" : count >= 2 ? "#fde68a" : "#e8e8ee";
      content += `
        <tr>
          <td style="background:${barColor};border:1px solid ${borderColor};border-radius:12px;padding:14px 16px;" colspan="2">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="vertical-align:top;">
                  <div style="font-size:14px;font-weight:700;color:#111;">${day}</div>
                  <div style="font-size:12px;color:#777;margin-top:4px;">${members.map(m => `${teamDot(m.team_name)}${m.name}`).join("&nbsp;&nbsp;")}</div>
                </td>
                <td style="vertical-align:top;text-align:right;width:50px;">
                  ${countBadge(count)}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }
    content += `</table>`;

    // Overlap warnings
    const highDays = [...weekSummary.entries()].filter(([, m]) => m.length >= 3);
    if (highDays.length > 0) {
      content += `
        <div style="background:#fef2f2;border-radius:14px;padding:16px 18px;margin-top:16px;border:1px solid #fecaca;">
          <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:6px;">&#9888;&#65039; Overlap Warning</div>
          <div style="font-size:12px;color:#991b1b;line-height:1.6;">
            ${highDays.map(([day, m]) => `<strong>${day}:</strong> ${m.length} people out — ${m.map(x => x.name).join(", ")}`).join("<br>")}
          </div>
        </div>`;
    }
  }

  // Team availability
  if (teamAvailability && teamAvailability.length > 0) {
    content += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#999;margin:24px 0 12px;">Team Coverage This Week</div>`;
    content += `<table style="width:100%;border-collapse:collapse;">`;
    for (const t of teamAvailability) {
      if (t.total === 0) continue;
      const color = TEAM_COLORS[t.name] || "#999";
      content += `
        <tr>
          <td style="padding:6px 0;width:90px;"><span style="font-size:12px;font-weight:600;color:#555;">${teamDot(t.name)}${t.name}</span></td>
          <td style="padding:6px 8px;">${availabilityBar(t.available, t.total, color)}</td>
          <td style="padding:6px 0;width:55px;text-align:right;"><span style="font-size:12px;font-weight:700;color:#333;">${t.available}/${t.total}</span></td>
        </tr>`;
    }
    content += `</table>`;
  }

  return emailWrapper("Weekly Digest", `Week of ${weekLabel}`, content);
}
