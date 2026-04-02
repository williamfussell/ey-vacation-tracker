import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";
import { format } from "date-fns";
import React from "react";

const TC: Record<string, string> = {
  "PM & Design": "#8B5CF6", Backend: "#3B82F6", Frontend: "#F59E0B", DevOps: "#10B981", Testing: "#F43F5E",
};

interface OutMember { name: string; team_name: string; returnDate: string; }
interface TeamAvail { name: string; total: number; available: number; }
interface DayPreview { short: string; count: number; }

function loadFont(name: string): Buffer {
  return readFileSync(join(process.cwd(), "public", name));
}

const D = "flex" as const;

function Dot({ color, size = 6 }: { color: string; size?: number }) {
  return <div style={{ display: D, width: size, height: size, borderRadius: 99, background: color, flexShrink: 0 }} />;
}

function Label({ children }: { children: string }) {
  return <div style={{ display: D, fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1.2, marginBottom: 10 }}>{children}</div>;
}

function StatCard({ num, label, numColor, bg }: { num: number; label: string; numColor: string; bg: string }) {
  return (
    <div style={{ display: D, flexDirection: "column", alignItems: "center", flex: 1, background: bg, borderRadius: 12, padding: "18px 12px" }}>
      <div style={{ display: D, fontSize: 36, fontWeight: 700, color: numColor }}>{String(num)}</div>
      <div style={{ display: D, fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export async function generateDailyEmailImage(
  outToday: OutMember[], outTomorrow: OutMember[], totalMembers: number, teamAvail: TeamAvail[], next5Days: DayPreview[]
): Promise<Buffer> {
  const todayStr = format(new Date(), "EEEE, MMMM d, yyyy");

  const grouped = new Map<string, OutMember[]>();
  for (const m of outToday) {
    const list = grouped.get(m.team_name) || [];
    list.push(m);
    grouped.set(m.team_name, list);
  }

  const element = (
    <div style={{ display: D, flexDirection: "column", width: 600, background: "#fff", fontFamily: "Inter" }}>
      {/* Header */}
      <div style={{ display: D, alignItems: "center", justifyContent: "space-between", padding: "28px 32px", background: "#111", color: "#fff" }}>
        <div style={{ display: D, flexDirection: "column" }}>
          <div style={{ display: D, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1.2 }}>DAILY REPORT</div>
          <div style={{ display: D, fontSize: 20, fontWeight: 700, marginTop: 4 }}>FlexiGenAI Team Tracker</div>
        </div>
        <div style={{ display: D, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{todayStr}</div>
      </div>

      {/* Stats */}
      <div style={{ display: D, gap: 12, padding: "24px 32px 0" }}>
        <StatCard num={outToday.length} label="OUT TODAY" numColor={outToday.length === 0 ? "#059669" : "#111"} bg={outToday.length === 0 ? "#ecfdf5" : "#f8f8fa"} />
        <StatCard num={totalMembers - outToday.length} label="AVAILABLE" numColor="#10b981" bg="#f8f8fa" />
        <StatCard num={totalMembers} label="TOTAL" numColor="#111" bg="#f8f8fa" />
      </div>

      {/* Who's Out Today */}
      {outToday.length > 0 ? (
        <div style={{ display: D, flexDirection: "column", padding: "20px 32px 0" }}>
          <Label>OUT TODAY</Label>
          {[...grouped.entries()].map(([team, mems]) => (
            <div key={team} style={{ display: D, flexDirection: "column", marginBottom: 8, padding: "10px 14px", background: "#fafafd", borderRadius: 10, borderLeft: `3px solid ${TC[team] || "#999"}` }}>
              <div style={{ display: D, fontSize: 9, fontWeight: 700, color: TC[team] || "#999", letterSpacing: 1, marginBottom: 6 }}>{team.toUpperCase()}</div>
              {mems.map((m, i) => (
                <div key={i} style={{ display: D, alignItems: "center", marginBottom: 2 }}>
                  <Dot color={TC[team] || "#999"} size={5} />
                  <div style={{ display: D, fontSize: 13, fontWeight: 500, color: "#333", marginLeft: 6 }}>{m.name}</div>
                  <div style={{ display: D, fontSize: 10, color: "#ccc", marginLeft: 6 }}>{`back ${m.returnDate}`}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: D, padding: "20px 32px 0", flexDirection: "column" }}>
          <Label>OUT TODAY</Label>
          <div style={{ display: D, fontSize: 12, fontWeight: 600, color: "#059669", background: "#ecfdf5", borderRadius: 8, padding: "10px 14px" }}>No one is out today</div>
        </div>
      )}

      {/* Who's Out Tomorrow */}
      {outTomorrow.length > 0 ? (
        <div style={{ display: D, flexDirection: "column", padding: "16px 32px 0" }}>
          <Label>OUT TOMORROW</Label>
          {(() => {
            const tg = new Map<string, OutMember[]>();
            for (const m of outTomorrow) { const l = tg.get(m.team_name) || []; l.push(m); tg.set(m.team_name, l); }
            return [...tg.entries()].map(([team, mems]) => (
              <div key={team} style={{ display: D, flexDirection: "column", marginBottom: 8, padding: "10px 14px", background: "#fafafd", borderRadius: 10, borderLeft: `3px solid ${TC[team] || "#999"}` }}>
                <div style={{ display: D, fontSize: 9, fontWeight: 700, color: TC[team] || "#999", letterSpacing: 1, marginBottom: 6 }}>{team.toUpperCase()}</div>
                {mems.map((m, i) => (
                  <div key={i} style={{ display: D, alignItems: "center", marginBottom: 2 }}>
                    <Dot color={TC[team] || "#999"} size={5} />
                    <div style={{ display: D, fontSize: 13, fontWeight: 500, color: "#333", marginLeft: 6 }}>{m.name}</div>
                    <div style={{ display: D, fontSize: 10, color: "#ccc", marginLeft: 6 }}>{`back ${m.returnDate}`}</div>
                  </div>
                ))}
              </div>
            ));
          })()}
        </div>
      ) : (
        <div style={{ display: D, padding: "16px 32px 0", flexDirection: "column" }}>
          <Label>OUT TOMORROW</Label>
          <div style={{ display: D, fontSize: 12, fontWeight: 600, color: "#059669", background: "#ecfdf5", borderRadius: 8, padding: "10px 14px" }}>No one is out tomorrow</div>
        </div>
      )}

      {/* Team Availability */}
      <div style={{ display: D, flexDirection: "column", padding: "20px 32px 0" }}>
        <Label>TEAM AVAILABILITY</Label>
        {teamAvail.filter(t => t.total > 0).map((t) => {
          const pct = Math.round((t.available / t.total) * 100);
          const c = TC[t.name] || "#999";
          return (
            <div key={t.name} style={{ display: D, alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: D, alignItems: "center", width: 100 }}>
                <Dot color={c} />
                <div style={{ display: D, fontSize: 11, fontWeight: 600, color: "#555", marginLeft: 4 }}>{t.name}</div>
              </div>
              <div style={{ display: D, flex: 1, height: 6, background: "#f0f0f5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ display: D, width: `${pct}%`, height: 6, background: pct < 50 ? "#dc2626" : c, borderRadius: 4 }} />
              </div>
              <div style={{ display: D, fontSize: 11, fontWeight: 700, color: "#333", width: 40, justifyContent: "flex-end" }}>{`${t.available}/${t.total}`}</div>
            </div>
          );
        })}
      </div>

      {/* Next 5 Days */}
      <div style={{ display: D, flexDirection: "column", padding: "20px 32px 24px" }}>
        <Label>NEXT 5 DAYS</Label>
        <div style={{ display: D, gap: 6 }}>
          {next5Days.map((d, i) => {
            const bg = d.count === 0 ? "#ecfdf5" : d.count <= 2 ? "#fefce8" : "#fef2f2";
            const clr = d.count === 0 ? "#059669" : d.count <= 2 ? "#d97706" : "#dc2626";
            return (
              <div key={i} style={{ display: D, flexDirection: "column", alignItems: "center", flex: 1, background: "#fafafd", borderRadius: 8, padding: "10px 6px" }}>
                <div style={{ display: D, fontSize: 9, fontWeight: 700, color: "#bbb" }}>{d.short}</div>
                <div style={{ display: D, marginTop: 6, background: bg, color: clr, fontSize: 14, fontWeight: 700, borderRadius: 20, padding: "2px 10px" }}>{String(d.count)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: D, alignItems: "center", justifyContent: "space-between", padding: "14px 32px", background: "#fafafd", borderTop: "1px solid #f0f0f5" }}>
        <div style={{ display: D, fontSize: 10, color: "#bbb" }}>ey-vacation-tracker.vercel.app</div>
        <div style={{ display: D, fontSize: 10, color: "#bbb" }}>FlexiGenAI Team Tracker</div>
      </div>
    </div>
  );

  const svg = await satori(element, {
    width: 600,
    fonts: [
      { name: "Inter", data: loadFont("Inter-Regular.ttf"), weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: loadFont("Inter-Bold.ttf"), weight: 700 as const, style: "normal" as const },
    ],
  });

  const png = await sharp(Buffer.from(svg)).resize(1200).png().toBuffer();
  return png;
}

// ── Weekly Image ──

interface WeekDayData {
  label: string;
  members: { name: string; team_name: string }[];
}

export async function generateWeeklyEmailImage(
  weekDays: WeekDayData[], totalMembers: number, teamAvail: TeamAvail[], weekLabel: string
): Promise<Buffer> {
  const hasAnyone = weekDays.some(d => d.members.length > 0);

  const element = (
    <div style={{ display: D, flexDirection: "column", width: 600, background: "#fff", fontFamily: "Inter" }}>
      {/* Header */}
      <div style={{ display: D, alignItems: "center", justifyContent: "space-between", padding: "28px 32px", background: "#111", color: "#fff" }}>
        <div style={{ display: D, flexDirection: "column" }}>
          <div style={{ display: D, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1.2 }}>WEEKLY DIGEST</div>
          <div style={{ display: D, fontSize: 20, fontWeight: 700, marginTop: 4 }}>FlexiGenAI Team Tracker</div>
        </div>
        <div style={{ display: D, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{`Week of ${weekLabel}`}</div>
      </div>

      {/* Day by day */}
      <div style={{ display: D, flexDirection: "column", padding: "24px 32px 0" }}>
        <Label>WEEK AT A GLANCE</Label>
        {!hasAnyone ? (
          <div style={{ display: D, fontSize: 12, fontWeight: 600, color: "#059669", background: "#ecfdf5", borderRadius: 8, padding: "14px" }}>No one is out this week — full team available</div>
        ) : (
          <div style={{ display: D, flexDirection: "column" }}>
            {weekDays.map((wd, i) => {
              const count = wd.members.length;
              const rowBg = count >= 3 ? "#fef2f2" : count > 0 ? "#fafafd" : "transparent";
              const countColor = count >= 3 ? "#dc2626" : count >= 2 ? "#d97706" : "#999";
              return (
                <div key={i} style={{ display: D, flexDirection: "column", padding: "10px 14px", background: rowBg, borderRadius: 8, marginBottom: 4, borderBottom: count === 0 ? "1px solid #f5f5f8" : "none" }}>
                  <div style={{ display: D, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: D, fontSize: 12, fontWeight: 700, color: "#111" }}>{wd.label}</div>
                    {count > 0 ? (
                      <div style={{ display: D, fontSize: 11, fontWeight: 700, color: countColor }}>{`${count} out`}</div>
                    ) : (
                      <div style={{ display: D, fontSize: 11, color: "#ddd" }}>All in</div>
                    )}
                  </div>
                  {count > 0 && (
                    <div style={{ display: D, flexDirection: "column", marginTop: 6, paddingLeft: 10, borderLeft: "2px solid #f0f0f5" }}>
                      {wd.members.map((m, j) => (
                        <div key={j} style={{ display: D, alignItems: "center", marginBottom: 2 }}>
                          <Dot color={TC[m.team_name] || "#999"} size={5} />
                          <div style={{ display: D, fontSize: 12, fontWeight: 500, color: "#444", marginLeft: 6 }}>{m.name}</div>
                          <div style={{ display: D, fontSize: 10, color: "#ccc", marginLeft: 6 }}>{m.team_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Availability */}
      <div style={{ display: D, flexDirection: "column", padding: "20px 32px 0" }}>
        <Label>TEAM COVERAGE</Label>
        {teamAvail.filter(t => t.total > 0).map((t) => {
          const pct = Math.round((t.available / t.total) * 100);
          const c = TC[t.name] || "#999";
          return (
            <div key={t.name} style={{ display: D, alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: D, alignItems: "center", width: 100 }}>
                <Dot color={c} />
                <div style={{ display: D, fontSize: 11, fontWeight: 600, color: "#555", marginLeft: 4 }}>{t.name}</div>
              </div>
              <div style={{ display: D, flex: 1, height: 6, background: "#f0f0f5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ display: D, width: `${pct}%`, height: 6, background: pct < 50 ? "#dc2626" : c, borderRadius: 4 }} />
              </div>
              <div style={{ display: D, fontSize: 11, fontWeight: 700, color: "#333", width: 40, justifyContent: "flex-end" }}>{`${t.available}/${t.total}`}</div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: D, alignItems: "center", justifyContent: "space-between", padding: "20px 32px", marginTop: 8, background: "#fafafd", borderTop: "1px solid #f0f0f5" }}>
        <div style={{ display: D, fontSize: 10, color: "#bbb" }}>ey-vacation-tracker.vercel.app</div>
        <div style={{ display: D, fontSize: 10, color: "#bbb" }}>FlexiGenAI Team Tracker</div>
      </div>
    </div>
  );

  const svg = await satori(element, {
    width: 600,
    fonts: [
      { name: "Inter", data: loadFont("Inter-Regular.ttf"), weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: loadFont("Inter-Bold.ttf"), weight: 700 as const, style: "normal" as const },
    ],
  });

  const png = await sharp(Buffer.from(svg)).resize(1200).png().toBuffer();
  return png;
}
