"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Team } from "@/lib/types";

interface AddMemberProps {
  teams: Team[];
  onMemberAdded: () => void;
}

export default function AddMember({ teams, onMemberAdded }: AddMemberProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setName(""); setTeamId(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const handleAdd = async () => {
    if (!name.trim() || !teamId) return;
    setAdding(true);
    const { error } = await supabase.from("members").insert({ name: name.trim(), team_id: teamId });
    if (!error) { setName(""); setTeamId(""); setOpen(false); onMemberAdded(); }
    setAdding(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="btn btn-secondary text-[11px]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add member
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[300px] bg-white rounded-xl border border-black/[.08] p-4 animate-scaleIn z-50" style={{ boxShadow: '0 12px 40px rgba(0,0,0,.1)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-3">New member</p>
          <input
            type="text" placeholder="Full name" value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="form-input w-full mb-2" autoFocus
          />
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="form-select w-full mb-3">
            <option value="">Select team...</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding || !name.trim() || !teamId} className="btn btn-primary text-[11px] flex-1 disabled:opacity-30">
              {adding ? "Adding..." : "Add"}
            </button>
            <button onClick={() => { setOpen(false); setName(""); setTeamId(""); }} className="btn btn-ghost text-[11px]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
