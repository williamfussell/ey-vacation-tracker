export interface Team {
  id: string;
  name: string;
  sort_order: number;
}

export interface Member {
  id: string;
  name: string;
  team_id: string;
}

export interface PtoEntry {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
}

export interface EditLogEntry {
  id: string;
  pto_entry_id: string | null;
  member_name: string;
  target_member_name: string;
  action: "create" | "delete";
  start_date: string;
  end_date: string;
  created_at: string;
}
