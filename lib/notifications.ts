import { createClient } from "@supabase/supabase-js";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";

// Server-side Supabase client (uses service role or anon key)
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
  const { data: members } = await supabase
    .from("members")
    .select("id, name, team_id")
    .in("id", memberIds);

  const { data: teams } = await supabase.from("teams").select("id, name");

  if (!members || !teams) return [];

  const teamMap = new Map(teams.map((t: { id: string; name: string }) => [t.id, t.name]));

  return members.map((m: { id: string; name: string; team_id: string }) => ({
    id: m.id,
    name: m.name,
    team_name: teamMap.get(m.team_id) || "Unknown",
  }));
}

export async function getWeekSummary(): Promise<
  Map<string, MemberWithTeam[]>
> {
  const supabase = getSupabase();
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);

  const { data: ptoEntries } = await supabase
    .from("pto_entries")
    .select("member_id, start_date, end_date")
    .lte("start_date", format(friday, "yyyy-MM-dd"))
    .gte("end_date", format(monday, "yyyy-MM-dd"));

  if (!ptoEntries || ptoEntries.length === 0) return new Map();

  const memberIds = [
    ...new Set(ptoEntries.map((e: PtoWithMember) => e.member_id)),
  ];
  const { data: members } = await supabase
    .from("members")
    .select("id, name, team_id")
    .in("id", memberIds);

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
      .filter(
        (e: PtoWithMember) => e.start_date <= dayStr && e.end_date >= dayStr
      )
      .map((e: PtoWithMember) => memberMap.get(e.member_id))
      .filter(Boolean) as MemberWithTeam[];

    if (outThisDay.length > 0) {
      result.set(dayLabel, outThisDay);
    }
  }

  return result;
}

export function formatDailyTeamsMessage(outToday: MemberWithTeam[]): string {
  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  if (outToday.length === 0) {
    return `**EY Vacation Tracker — ${today}**\n\nNo one is out today! Full team available.`;
  }

  const grouped = new Map<string, string[]>();
  for (const m of outToday) {
    const list = grouped.get(m.team_name) || [];
    list.push(m.name);
    grouped.set(m.team_name, list);
  }

  let msg = `**EY Vacation Tracker — ${today}**\n\n`;
  msg += `**${outToday.length}** ${outToday.length === 1 ? "person" : "people"} out today:\n\n`;

  for (const [team, names] of grouped) {
    msg += `**${team}:** ${names.join(", ")}\n\n`;
  }

  return msg;
}

export function formatWeeklyTeamsMessage(
  weekSummary: Map<string, MemberWithTeam[]>
): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "MMM d")} – ${format(friday, "MMM d, yyyy")}`;

  if (weekSummary.size === 0) {
    return `**EY Vacation Tracker — Week of ${weekLabel}**\n\nNo one is out this week! Full team available.`;
  }

  let msg = `**EY Vacation Tracker — Week of ${weekLabel}**\n\n`;

  for (const [day, members] of weekSummary) {
    msg += `**${day}** — ${members.map((m) => m.name).join(", ")}\n\n`;
  }

  return msg;
}

export function formatWeeklyEmailHtml(
  weekSummary: Map<string, MemberWithTeam[]>
): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "MMM d")} – ${format(friday, "MMM d, yyyy")}`;

  let html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">EY Vacation Tracker — Week of ${weekLabel}</h2>
  `;

  if (weekSummary.size === 0) {
    html += `<p style="color: #64748b;">No one is out this week! Full team available.</p>`;
  } else {
    html += `<table style="width: 100%; border-collapse: collapse; margin-top: 16px;">`;
    html += `<tr style="background: #f1f5f9;">
      <th style="text-align: left; padding: 8px 12px; font-size: 14px;">Day</th>
      <th style="text-align: left; padding: 8px 12px; font-size: 14px;">Out</th>
    </tr>`;

    for (const [day, members] of weekSummary) {
      html += `<tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 12px; font-size: 14px; font-weight: 600;">${day}</td>
        <td style="padding: 8px 12px; font-size: 14px;">${members
          .map((m) => `${m.name} <span style="color:#94a3b8;">(${m.team_name})</span>`)
          .join(", ")}</td>
      </tr>`;
    }

    html += `</table>`;
  }

  html += `
      <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">
        Sent by EY Vacation Tracker
      </p>
    </div>
  `;

  return html;
}
