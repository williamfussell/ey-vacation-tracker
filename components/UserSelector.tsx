"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Member, Team } from "@/lib/types";

interface UserSelectorProps {
  currentUser: string | null;
  onUserChange: (name: string) => void;
  members: Member[];
  teams: Team[];
  onMemberAdded: () => void;
}

export default function UserSelector({
  currentUser,
  onUserChange,
  members,
  teams,
  onMemberAdded,
}: UserSelectorProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ey-vt-user");
    if (stored && !currentUser) onUserChange(stored);
  }, [currentUser, onUserChange]);

  const handleSelect = (name: string) => {
    localStorage.setItem("ey-vt-user", name);
    onUserChange(name);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newTeam) return;
    setAdding(true);
    const { error } = await supabase.from("members").insert({ name: newName.trim(), team_id: newTeam });
    if (!error) {
      handleSelect(newName.trim());
      setNewName(""); setNewTeam(""); setShowAdd(false);
      onMemberAdded();
    }
    setAdding(false);
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#B0B3C7' }}>
        Signed in as
      </span>

      <select
        value={currentUser || ""}
        onChange={(e) => handleSelect(e.target.value)}
        className="form-select min-w-[200px]"
      >
        <option value="">Select your name...</option>
        {members.sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
          <option key={m.id} value={m.name}>{m.name}</option>
        ))}
      </select>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn btn-ghost text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Add yourself
        </button>
      ) : (
        <div className="flex items-center gap-2 animate-fadeIn">
          <input
            type="text" placeholder="Your name" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="form-input w-[160px]" autoFocus
          />
          <select value={newTeam} onChange={(e) => setNewTeam(e.target.value)} className="form-select">
            <option value="">Team...</option>
            {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <button onClick={handleAdd} disabled={adding || !newName.trim() || !newTeam} className="btn btn-primary text-xs disabled:opacity-40">
            {adding ? "Adding..." : "Add"}
          </button>
          <button onClick={() => { setShowAdd(false); setNewName(""); setNewTeam(""); }} className="btn btn-ghost text-xs">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
