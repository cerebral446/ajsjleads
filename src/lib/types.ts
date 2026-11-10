export type LeadStatus = {
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_terminal: boolean;
  is_active: boolean;
};

export type LeadSource = {
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type Lead = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  job_title: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  last_contacted_at: string | null;
  last_outcome: string | null;
  last_note: string | null;
  next_follow_up_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  assigned?: { full_name: string | null } | null;
  creator?: { full_name: string | null } | null;
};

export type ActivityType =
  | "created"
  | "call"
  | "note"
  | "follow_up"
  | "follow_up_done"
  | "follow_up_cleared"
  | "status_change";

export type Activity = {
  id: string;
  lead_id: string;
  type: ActivityType | string;
  outcome: string | null;
  notes: string | null;
  metadata: {
    follow_up_at?: string;
    status_from?: string;
    status_to?: string;
    status?: string;
  };
  created_by: string | null;
  created_at: string;
  author?: { full_name: string | null } | null;
  lead?: { id: string; company_name: string | null; contact_name: string | null } | null;
};

/** Editable fields on the lead form */
export type LeadInput = {
  company_name: string;
  contact_name: string;
  job_title: string;
  phone: string;
  email: string;
  website: string;
  location: string;
  source: string;
  status: string;
  notes: string;
  assigned_to: string;
};

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Columns + joins selected for lead cards / detail */
export const LEAD_SELECT =
  "*, assigned:profiles!leads_assigned_to_fkey(full_name), creator:profiles!leads_created_by_fkey(full_name)";

export const ACTIVITY_SELECT =
  "*, author:profiles!activities_created_by_fkey(full_name), lead:leads(id, company_name, contact_name)";
