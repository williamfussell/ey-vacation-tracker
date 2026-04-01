"use client";

import { useState, useCallback, useRef, useEffect, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import type { Member, Team, PtoEntry } from "@/lib/types";
import AddMember from "@/components/AddMember";
import {
  getGridDays,
  getMonthHeaders,
  toDateString,
  isDateInRange,
  isWeekend,
  isToday,
  isMonday,
  getDate,
  format,
  addDays,
} from "@/lib/dates";

interface PtoGridProps {
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
};

export default function PtoGrid({ teams, members, ptoEntries, onDataChange, onMemberAdded }: PtoGridProps) {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(now, diff);
  });
  const [numWeeks, setNumWeeks] = useState(4);
  const [dragState, setDragState] = useState<{ memberId: string; startIdx: number; endIdx: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ entryId: string; memberName: string; startDate: string; endDate: string } | null>(null);
  const isDragging = useRef(false);

  const days = getGridDays(startDate, numWeeks);
  const monthHeaders = getMonthHeaders(days);
  const membersByTeam = teams.map((team) => ({
    team,
    members: members.filter((m) => m.team_id === team.id).sort((a, b) => a.name.localeCompare(b.name)),
  }));

  const getPtoForCell = useCallback(
    (memberId: string, date: Date): PtoEntry | undefined =>
      ptoEntries.find((e) => e.member_id === memberId && isDateInRange(date, e.start_date, e.end_date)),
    [ptoEntries]
  );

  const getPtoPosition = useCallback(
    (memberId: string, date: Date): "start" | "mid" | "end" | "single" | null => {
      const pto = getPtoForCell(memberId, date);
      if (!pto) return null;
      const ds = toDateString(date);
      if (ds === pto.start_date && ds === pto.end_date) return "single";
      if (ds === pto.start_date) return "start";
      if (ds === pto.end_date) return "end";
      return "mid";
    },
    [getPtoForCell]
  );

  const isInDragRange = (memberId: string, dayIdx: number): boolean => {
    if (!dragState || dragState.memberId !== memberId) return false;
    const min = Math.min(dragState.startIdx, dragState.endIdx);
    const max = Math.max(dragState.startIdx, dragState.endIdx);
    return dayIdx >= min && dayIdx <= max;
  };

  const handleMouseDown = (memberId: string, dayIdx: number, date: Date) => {
    const existingPto = getPtoForCell(memberId, date);
    if (existingPto) {
      const targetMember = members.find((m) => m.id === memberId);
      setConfirmDelete({ entryId: existingPto.id, memberName: targetMember?.name || "Unknown", startDate: existingPto.start_date, endDate: existingPto.end_date });
      return;
    }
    isDragging.current = true;
    setDragState({ memberId, startIdx: dayIdx, endIdx: dayIdx });
  };

  const handleMouseEnter = (memberId: string, dayIdx: number) => {
    if (!isDragging.current || !dragState || dragState.memberId !== memberId) return;
    setDragState((prev) => (prev ? { ...prev, endIdx: dayIdx } : null));
  };

  const handleMouseUp = async () => {
    if (!isDragging.current || !dragState) { isDragging.current = false; return; }
    isDragging.current = false;
    const min = Math.min(dragState.startIdx, dragState.endIdx);
    const max = Math.max(dragState.startIdx, dragState.endIdx);
    const sDate = toDateString(days[min]);
    const eDate = toDateString(days[max]);
    const targetMember = members.find((m) => m.id === dragState.memberId);

    const { data, error } = await supabase.from("pto_entries").insert({ member_id: dragState.memberId, start_date: sDate, end_date: eDate }).select().single();
    if (!error && data) {
      await supabase.from("edit_log").insert({ pto_entry_id: data.id, member_name: "Team", target_member_name: targetMember?.name || "Unknown", action: "create", start_date: sDate, end_date: eDate });
      onDataChange();
    }
    setDragState(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await supabase.from("edit_log").insert({ pto_entry_id: confirmDelete.entryId, member_name: "Team", target_member_name: confirmDelete.memberName, action: "delete", start_date: confirmDelete.startDate, end_date: confirmDelete.endDate });
    await supabase.from("pto_entries").delete().eq("id", confirmDelete.entryId);
    onDataChange();
    setConfirmDelete(null);
  };

  useEffect(() => {
    const h = () => { if (isDragging.current) handleMouseUp(); };
    window.addEventListener("mouseup", h);
    return () => window.removeEventListener("mouseup", h);
  });

  const navigate = (d: number) => setStartDate((prev) => addDays(prev, d * 7));
  const goToToday = () => {
    const now = new Date(); const day = now.getDay(); const diff = day === 0 ? -6 : 1 - day;
    setStartDate(addDays(now, diff));
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="btn btn-ghost">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button onClick={goToToday} className="btn btn-primary text-[11px]">Today</button>
          <button onClick={() => navigate(1)} className="btn btn-ghost">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>

          <div className="w-px h-4 mx-2 bg-black/[.06]" />

          <input
            type="date"
            value={format(startDate, "yyyy-MM-dd")}
            onChange={(e) => {
              if (!e.target.value) return;
              const picked = new Date(e.target.value + "T00:00:00");
              const day = picked.getDay(); const diff = day === 0 ? -6 : 1 - day;
              setStartDate(addDays(picked, diff));
            }}
            className="form-input text-[12px]"
          />

          <span className="text-[12px] font-medium text-[#BBB] ml-2">
            {format(days[0], "MMM d")} &mdash; {format(days[days.length - 1], "MMM d, yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <AddMember teams={teams} onMemberAdded={onMemberAdded} />
          <div className="w-px h-4 bg-black/[.06]" />
          <select value={numWeeks} onChange={(e) => setNumWeeks(Number(e.target.value))} className="form-select text-[12px]">
            <option value={2}>2 wk</option>
            <option value={3}>3 wk</option>
            <option value={4}>4 wk</option>
            <option value={6}>6 wk</option>
            <option value={8}>8 wk</option>
            <option value={12}>12 wk</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="pto-grid">
        <table>
          <thead>
            <tr>
              <th className="name-col name-col-header" />
              {monthHeaders.map((mh, i) => (
                <th key={i} colSpan={mh.span} className="month-header">{mh.label}</th>
              ))}
            </tr>
            <tr>
              <th className="name-col name-col-header">Name</th>
              {days.map((day, i) => (
                <th key={i} className={["day-header", isWeekend(day) && "weekend", isToday(day) && "today", isMonday(day) && "week-start", getDate(day) === 1 && "month-start"].filter(Boolean).join(" ")}>
                  <div className="day-name">{format(day, "EEE")}</div>
                  <div className="day-num">{format(day, "d")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {membersByTeam.map(({ team, members: tm }) => (
              <Fragment key={team.id}>
                <tr className="team-header-row">
                  <td colSpan={days.length + 1} className="team-header">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: TEAM_COLORS[team.name] || "#999" }} />
                      {team.name}
                      <span className="text-[#CCC] font-medium">{tm.length}</span>
                    </span>
                  </td>
                </tr>
                {tm.map((member) => (
                  <tr key={member.id}>
                    <td className="name-col"><div className="flex items-center h-[42px]">{member.name}</div></td>
                    {days.map((day, dayIdx) => {
                      const pto = getPtoForCell(member.id, day);
                      const ptoPos = getPtoPosition(member.id, day);
                      const selecting = dragState?.memberId === member.id && isInDragRange(member.id, dayIdx);
                      return (
                        <td
                          key={dayIdx}
                          className={["day-col", isWeekend(day) && "weekend", isToday(day) && "today", isMonday(day) && "week-start", getDate(day) === 1 && "month-start", pto && "pto", ptoPos && `pto-${ptoPos}`, selecting && "selecting"].filter(Boolean).join(" ")}
                          onMouseDown={() => handleMouseDown(member.id, dayIdx, day)}
                          onMouseEnter={() => handleMouseEnter(member.id, dayIdx)}
                          title={pto ? `${pto.start_date} → ${pto.end_date}` : format(day, "MMM d, yyyy")}
                        >
                          {pto && <div className="pto-bar" />}
                          {selecting && !pto && <div className="select-bar" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50">
          <div className="modal-card p-6 w-[380px] mx-4 animate-scaleIn">
            <h3 className="text-[14px] font-semibold text-[#111] mb-1">Remove time off</h3>
            <p className="text-[12px] text-[#999] mb-4">This change will be recorded in the edit history.</p>
            <p className="text-[13px] text-[#444] leading-relaxed mb-5">
              Remove PTO for <strong className="text-[#111]">{confirmDelete.memberName}</strong> from{" "}
              <span className="font-mono text-[12px] bg-black/[.04] px-1.5 py-0.5 rounded">{confirmDelete.startDate}</span> to{" "}
              <span className="font-mono text-[12px] bg-black/[.04] px-1.5 py-0.5 rounded">{confirmDelete.endDate}</span>?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary text-[12px]">Cancel</button>
              <button onClick={handleDelete} className="btn btn-danger text-[12px]">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-[10px] rounded-sm bg-[#111]" />
          <span className="text-[10px] font-medium text-[#BBB]">PTO</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#FFFCF0] border border-black/[.06] relative">
            <div className="absolute top-0 left-[20%] right-[20%] h-[2px] bg-[#F59E0B] rounded-b-sm" />
          </div>
          <span className="text-[10px] font-medium text-[#BBB]">Today</span>
        </div>
        <span className="ml-auto text-[10px] text-[#DDD]">Drag to add &middot; click to remove</span>
      </div>
    </div>
  );
}
