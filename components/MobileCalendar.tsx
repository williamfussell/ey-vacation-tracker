"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Member, Team, PtoEntry } from "@/lib/types";
import AddMember from "@/components/AddMember";
import {
  format,
  addDays,
  startOfWeek,
  eachDayOfInterval,
  isWeekend,
  isToday,
} from "date-fns";

interface MobileCalendarProps {
  teams: Team[];
  members: Member[];
  ptoEntries: PtoEntry[];
  onDataChange: () => void;
  onMemberAdded: () => void;
}

const TEAM_COLORS: Record<string, string> = {
  "PM & Design": "#8B5CF6",
  Backend: "#3B82F6",
  Frontend: "#F59E0B",
  DevOps: "#10B981",
  Testing: "#F43F5E",
};

export default function MobileCalendar({
  teams,
  members,
  ptoEntries,
  onDataChange,
  onMemberAdded,
}: MobileCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: monday, end: addDays(monday, 6) });

  const getOutForDay = (date: Date) => {
    const ds = format(date, "yyyy-MM-dd");
    return ptoEntries
      .filter((e) => e.start_date <= ds && e.end_date >= ds)
      .map((e) => {
        const member = members.find((m) => m.id === e.member_id);
        const team = teams.find((t) => t.id === member?.team_id);
        return {
          id: e.id,
          name: member?.name || "Unknown",
          teamName: team?.name || "",
          startDate: e.start_date,
          endDate: e.end_date,
        };
      });
  };

  const handleDelete = async (entryId: string) => {
    const entry = ptoEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const member = members.find((m) => m.id === entry.member_id);
    if (!window.confirm(`Remove PTO for ${member?.name}?`)) return;

    await supabase.from("edit_log").insert({
      pto_entry_id: entryId,
      member_name: "Team",
      target_member_name: member?.name || "Unknown",
      action: "delete",
      start_date: entry.start_date,
      end_date: entry.end_date,
    });
    await supabase.from("pto_entries").delete().eq("id", entryId);
    onDataChange();
  };

  // Members grouped by team for the "add PTO" sheet
  const [showAddPto, setShowAddPto] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [ptoStart, setPtoStart] = useState("");
  const [ptoEnd, setPtoEnd] = useState("");

  const handleAddPto = async () => {
    if (!selectedMember || !ptoStart || !ptoEnd) return;
    const member = members.find((m) => m.id === selectedMember);
    const { data, error } = await supabase
      .from("pto_entries")
      .insert({ member_id: selectedMember, start_date: ptoStart, end_date: ptoEnd })
      .select()
      .single();
    if (!error && data) {
      await supabase.from("edit_log").insert({
        pto_entry_id: data.id,
        member_name: "Team",
        target_member_name: member?.name || "Unknown",
        action: "create",
        start_date: ptoStart,
        end_date: ptoEnd,
      });
      onDataChange();
      setShowAddPto(false);
      setSelectedMember("");
      setPtoStart("");
      setPtoEnd("");
    }
  };

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekOffset((w) => w - 1)} className="btn btn-ghost">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="text-center">
          <div className="text-[13px] font-semibold text-[#111]">
            {format(monday, "MMM d")} — {format(addDays(monday, 6), "MMM d, yyyy")}
          </div>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-[11px] font-medium text-[#999] mt-0.5">
              Go to this week
            </button>
          )}
        </div>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="btn btn-ghost">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* Day list */}
      <div className="flex flex-col gap-2">
        {days.map((day) => {
          const out = getOutForDay(day);
          const weekend = isWeekend(day);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className="bg-white rounded-xl border border-black/[.06] overflow-hidden"
              style={{
                boxShadow: today ? '0 0 0 2px #F59E0B' : '0 1px 3px rgba(0,0,0,.03)',
                opacity: weekend && out.length === 0 ? 0.5 : 1,
              }}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[.04]" style={{ background: today ? '#FFFCF0' : weekend ? '#FAFAFA' : '#fff' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[#111]">{format(day, "EEEE")}</span>
                  <span className="text-[13px] font-medium text-[#999]">{format(day, "MMM d")}</span>
                  {today && <span className="text-[9px] font-bold uppercase tracking-wider text-[#F59E0B] bg-[#FEF3C7] px-1.5 py-0.5 rounded">Today</span>}
                </div>
                <span className="text-[11px] font-medium text-[#BBB]">
                  {out.length > 0 ? `${out.length} out` : weekend ? "Weekend" : "All in"}
                </span>
              </div>

              {/* People out */}
              {out.length > 0 && (
                <div className="px-4 py-2">
                  {out.map((person) => (
                    <div key={person.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: TEAM_COLORS[person.teamName] || "#999" }} />
                        <span className="text-[13px] font-medium text-[#333]">{person.name}</span>
                        <span className="text-[10px] text-[#CCC]">{person.teamName}</span>
                      </div>
                      <button
                        onClick={() => handleDelete(person.id)}
                        className="p-1 rounded hover:bg-red-50 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="flex gap-2 mt-4">
        <button onClick={() => setShowAddPto(true)} className="btn btn-primary text-[12px] flex-1">
          + Add PTO
        </button>
        <AddMember teams={teams} onMemberAdded={onMemberAdded} />
      </div>

      {/* Add PTO sheet */}
      {showAddPto && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-center z-50" onClick={() => setShowAddPto(false)}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg p-6 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-[#111]">Add PTO</h3>
              <button onClick={() => setShowAddPto(false)} className="btn btn-ghost p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="form-select w-full"
              >
                <option value="">Select person...</option>
                {members.sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[#999] block mb-1">Start</label>
                  <input type="date" value={ptoStart} onChange={(e) => setPtoStart(e.target.value)} className="form-input w-full" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[#999] block mb-1">End</label>
                  <input type="date" value={ptoEnd} onChange={(e) => setPtoEnd(e.target.value)} className="form-input w-full" />
                </div>
              </div>
              <button
                onClick={handleAddPto}
                disabled={!selectedMember || !ptoStart || !ptoEnd}
                className="btn btn-primary text-[13px] w-full py-3 disabled:opacity-30"
              >
                Add PTO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
