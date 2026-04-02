import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { format, addDays, startOfWeek } from "date-fns";

const TEAM_COLORS: Record<string, string> = {
  "PM & Design": "#8B5CF6",
  Backend: "#3B82F6",
  Frontend: "#F59E0B",
  DevOps: "#10B981",
  Testing: "#F43F5E",
};

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", backgroundColor: "#fff" },
  header: { marginBottom: 24 },
  title: { fontSize: 20, fontWeight: "bold", color: "#111", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#999", textTransform: "uppercase" as const, letterSpacing: 1.2 },
  date: { fontSize: 13, color: "#666", marginTop: 4 },
  statsRow: { flexDirection: "row" as const, gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: "#f8f8fa", borderRadius: 10, padding: 16, alignItems: "center" as const },
  statNum: { fontSize: 32, fontWeight: "bold", color: "#111" },
  statLabel: { fontSize: 8, color: "#999", textTransform: "uppercase" as const, letterSpacing: 1, marginTop: 4 },
  sectionTitle: { fontSize: 9, fontWeight: "bold", color: "#999", textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 10, marginTop: 20 },
  teamBlock: { marginBottom: 10, padding: 12, backgroundColor: "#fafafd", borderRadius: 8, borderLeftWidth: 3, borderLeftStyle: "solid" as const },
  teamName: { fontSize: 9, fontWeight: "bold", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 6 },
  memberName: { fontSize: 12, color: "#333", marginBottom: 3 },
  availRow: { flexDirection: "row" as const, alignItems: "center" as const, marginBottom: 6 },
  availLabel: { fontSize: 10, color: "#555", width: 90 },
  availBarBg: { flex: 1, height: 8, backgroundColor: "#f0f0f5", borderRadius: 4, overflow: "hidden" as const },
  availBarFill: { height: 8, borderRadius: 4 },
  availCount: { fontSize: 10, fontWeight: "bold", color: "#333", width: 40, textAlign: "right" as const },
  dayRow: { flexDirection: "row" as const, marginBottom: 4, padding: 10, backgroundColor: "#fafafd", borderRadius: 8 },
  dayName: { fontSize: 11, fontWeight: "bold", color: "#111", width: 120 },
  dayMembers: { flex: 1, fontSize: 10, color: "#555" },
  dayCount: { width: 30, textAlign: "right" as const, fontSize: 12, fontWeight: "bold" },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  alertBox: { backgroundColor: "#fef2f2", borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: "#fecaca", borderStyle: "solid" as const },
  alertTitle: { fontSize: 10, fontWeight: "bold", color: "#dc2626", marginBottom: 4 },
  alertText: { fontSize: 9, color: "#991b1b" },
  footer: { marginTop: 30, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#f0f0f5", borderTopStyle: "solid" as const },
  footerText: { fontSize: 8, color: "#bbb" },
  greenCard: { backgroundColor: "#ecfdf5", borderRadius: 10, padding: 20, alignItems: "center" as const, marginBottom: 20 },
  greenText: { fontSize: 14, fontWeight: "bold", color: "#059669" },
  greenSub: { fontSize: 10, color: "#10b981", marginTop: 4 },
  next5Row: { flexDirection: "row" as const, gap: 6, marginTop: 4 },
  next5Cell: { flex: 1, backgroundColor: "#fafafd", borderRadius: 8, padding: 8, alignItems: "center" as const },
  next5Day: { fontSize: 8, color: "#999", fontWeight: "bold" },
  next5Count: { fontSize: 14, fontWeight: "bold", marginTop: 4 },
});

interface MemberWithTeam {
  name: string;
  team_name: string;
}

interface TeamAvail {
  name: string;
  total: number;
  available: number;
}

interface DayPreview {
  short: string;
  count: number;
}

interface WeekDay {
  day: string;
  members: MemberWithTeam[];
}

// ── Daily Report ──

function DailyReport({
  outToday,
  totalMembers,
  teamAvail,
  next5Days,
}: {
  outToday: MemberWithTeam[];
  totalMembers: number;
  teamAvail: TeamAvail[];
  next5Days: DayPreview[];
}) {
  const todayStr = format(new Date(), "EEEE, MMMM d, yyyy");

  const grouped = new Map<string, MemberWithTeam[]>();
  for (const m of outToday) {
    const list = grouped.get(m.team_name) || [];
    list.push(m);
    grouped.set(m.team_name, list);
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.subtitle}>Daily Report</Text>
          <Text style={s.title}>FlexiGenAI Team Tracker</Text>
          <Text style={s.date}>{todayStr}</Text>
        </View>

        {outToday.length === 0 ? (
          <View style={s.greenCard}>
            <Text style={s.greenText}>Full Team Available</Text>
            <Text style={s.greenSub}>All {totalMembers} members are in today</Text>
          </View>
        ) : (
          <>
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statNum}>{outToday.length}</Text>
                <Text style={s.statLabel}>Out Today</Text>
              </View>
              <View style={s.statCard}>
                <Text style={{ ...s.statNum, color: "#10b981" }}>{totalMembers - outToday.length}</Text>
                <Text style={s.statLabel}>Available</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statNum}>{totalMembers}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
            </View>

            <Text style={s.sectionTitle}>Who&apos;s Out</Text>
            {[...grouped.entries()].map(([team, members]) => (
              <View key={team} style={{ ...s.teamBlock, borderLeftColor: TEAM_COLORS[team] || "#999" }}>
                <Text style={{ ...s.teamName, color: TEAM_COLORS[team] || "#999" }}>{team}</Text>
                {members.map((m, i) => (
                  <Text key={i} style={s.memberName}>• {m.name}</Text>
                ))}
              </View>
            ))}
          </>
        )}

        <Text style={s.sectionTitle}>Team Availability</Text>
        {teamAvail.filter(t => t.total > 0).map((t) => (
          <View key={t.name} style={s.availRow}>
            <Text style={s.availLabel}>{t.name}</Text>
            <View style={s.availBarBg}>
              <View style={{ ...s.availBarFill, backgroundColor: TEAM_COLORS[t.name] || "#999", width: `${t.total > 0 ? Math.round((t.available / t.total) * 100) : 100}%` }} />
            </View>
            <Text style={s.availCount}>{t.available}/{t.total}</Text>
          </View>
        ))}

        <Text style={s.sectionTitle}>Next 5 Days</Text>
        <View style={s.next5Row}>
          {next5Days.map((d, i) => (
            <View key={i} style={s.next5Cell}>
              <Text style={s.next5Day}>{d.short}</Text>
              <Text style={{ ...s.next5Count, color: d.count === 0 ? "#059669" : d.count <= 2 ? "#d97706" : "#dc2626" }}>
                {d.count}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Generated by FlexiGenAI Team Tracker • ey-vacation-tracker.vercel.app</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Weekly Report ──

function WeeklyReport({
  weekDays,
  totalMembers,
  teamAvail,
  weekLabel,
}: {
  weekDays: WeekDay[];
  totalMembers: number;
  teamAvail: TeamAvail[];
  weekLabel: string;
}) {
  const hasAnyone = weekDays.some(d => d.members.length > 0);
  const highDays = weekDays.filter(d => d.members.length >= 3);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.subtitle}>Weekly Digest</Text>
          <Text style={s.title}>FlexiGenAI Team Tracker</Text>
          <Text style={s.date}>Week of {weekLabel}</Text>
        </View>

        {!hasAnyone ? (
          <View style={s.greenCard}>
            <Text style={s.greenText}>No One Is Out This Week</Text>
            <Text style={s.greenSub}>Full team of {totalMembers} available</Text>
          </View>
        ) : (
          <>
            <Text style={s.sectionTitle}>Day by Day</Text>
            {weekDays.map((wd) => (
              <View key={wd.day} style={{
                ...s.dayRow,
                backgroundColor: wd.members.length >= 3 ? "#fef2f2" : "#fafafd",
              }}>
                <Text style={s.dayName}>{wd.day}</Text>
                <Text style={s.dayMembers}>
                  {wd.members.length > 0 ? wd.members.map(m => m.name).join(", ") : "All in"}
                </Text>
                <Text style={{
                  ...s.dayCount,
                  color: wd.members.length === 0 ? "#059669" : wd.members.length >= 3 ? "#dc2626" : wd.members.length >= 2 ? "#d97706" : "#111"
                }}>
                  {wd.members.length}
                </Text>
              </View>
            ))}

            {highDays.length > 0 && (
              <View style={s.alertBox}>
                <Text style={s.alertTitle}>⚠ Overlap Warning</Text>
                {highDays.map((d, i) => (
                  <Text key={i} style={s.alertText}>
                    {d.day}: {d.members.length} people out — {d.members.map(m => m.name).join(", ")}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={s.sectionTitle}>Team Coverage</Text>
        {teamAvail.filter(t => t.total > 0).map((t) => (
          <View key={t.name} style={s.availRow}>
            <Text style={s.availLabel}>{t.name}</Text>
            <View style={s.availBarBg}>
              <View style={{ ...s.availBarFill, backgroundColor: TEAM_COLORS[t.name] || "#999", width: `${t.total > 0 ? Math.round((t.available / t.total) * 100) : 100}%` }} />
            </View>
            <Text style={s.availCount}>{t.available}/{t.total}</Text>
          </View>
        ))}

        <View style={s.footer}>
          <Text style={s.footerText}>Generated by FlexiGenAI Team Tracker • ey-vacation-tracker.vercel.app</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Render functions ──

export async function generateDailyPdf(
  outToday: MemberWithTeam[],
  totalMembers: number,
  teamAvail: TeamAvail[],
  next5Days: DayPreview[]
): Promise<Buffer> {
  return await renderToBuffer(
    <DailyReport
      outToday={outToday}
      totalMembers={totalMembers}
      teamAvail={teamAvail}
      next5Days={next5Days}
    />
  );
}

export async function generateWeeklyPdf(
  weekSummary: Map<string, MemberWithTeam[]>,
  totalMembers: number,
  teamAvail: TeamAvail[]
): Promise<Buffer> {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "MMM d")} – ${format(friday, "MMM d, yyyy")}`;

  const weekDays: WeekDay[] = [];
  for (let i = 0; i < 5; i++) {
    const d = addDays(monday, i);
    const dayLabel = format(d, "EEEE, MMM d");
    weekDays.push({
      day: dayLabel,
      members: weekSummary.get(dayLabel) || [],
    });
  }

  return await renderToBuffer(
    <WeeklyReport
      weekDays={weekDays}
      totalMembers={totalMembers}
      teamAvail={teamAvail}
      weekLabel={weekLabel}
    />
  );
}
