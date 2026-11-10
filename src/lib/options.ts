/**
 * Call outcomes are fixed in code (they drive status suggestions).
 * Statuses and lead sources live in the database so they can be edited.
 */
export const CALL_OUTCOMES = [
  { key: "no_answer", label: "No Answer", suggest: "no_answer" },
  { key: "left_voicemail", label: "Left Voicemail", suggest: "attempted_contact" },
  { key: "spoke_receptionist", label: "Spoke With Receptionist", suggest: "attempted_contact" },
  { key: "spoke_contact", label: "Spoke With Contact", suggest: "contacted" },
  { key: "call_back", label: "Asked to Call Back", suggest: "follow_up_needed" },
  { key: "send_email", label: "Send Email", suggest: "send_information" },
  { key: "interested", label: "Interested", suggest: "interested" },
  { key: "not_interested", label: "Not Interested", suggest: "not_interested" },
  { key: "wrong_number", label: "Wrong Number", suggest: null },
  { key: "other", label: "Other", suggest: null },
] as const;

export type CallOutcomeKey = (typeof CALL_OUTCOMES)[number]["key"];

export function outcomeLabel(key: string | null | undefined): string {
  if (!key) return "";
  return CALL_OUTCOMES.find((o) => o.key === key)?.label ?? key.replace(/_/g, " ");
}

/** Shortcut follow-ups land at this hour (local app time zone) */
export const FOLLOW_UP_DEFAULT_HOUR = 9;

export const QUICK_FOLLOW_UPS = [
  { label: "Tomorrow", days: 1 },
  { label: "2 Days", days: 2 },
  { label: "3 Days", days: 3 },
  { label: "1 Week", days: 7 },
  { label: "2 Weeks", days: 14 },
] as const;
