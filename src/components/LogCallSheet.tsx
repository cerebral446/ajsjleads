"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CALL_OUTCOMES } from "@/lib/options";
import { formatDateTime } from "@/lib/dates";
import { logCall } from "@/app/actions";
import { useAppData } from "./AppData";
import { useToast } from "./Toast";
import { Sheet, SectionLabel, PrimaryButton } from "./Sheet";
import { FollowUpPicker, resolveFollowUp, type FollowUpChoice } from "./FollowUpPicker";
import { STATUS_DOT } from "./StatusBadge";

type LeadLite = { id: string; company_name: string | null; contact_name: string | null; status: string };

export function LogCallSheet({ lead, open, onClose }: { lead: LeadLite; open: boolean; onClose: () => void }) {
  const { statuses, statusMap, me } = useAppData();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState<FollowUpChoice>({ kind: "none" });
  const [newStatus, setNewStatus] = useState<string>(""); // "" = keep current
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => new Date());

  useEffect(() => {
    if (open) {
      setOutcome(null);
      setNotes("");
      setFollowUp({ kind: "none" });
      setNewStatus("");
      setError(null);
      setStartedAt(new Date());
    }
  }, [open]);

  const current = statusMap[lead.status];
  const activeStatuses = useMemo(() => statuses.filter((s) => s.is_active), [statuses]);

  function pickOutcome(key: string) {
    setOutcome(key);
    // Suggest a status — only if it moves the lead forward in the pipeline
    const suggest = CALL_OUTCOMES.find((o) => o.key === key)?.suggest;
    const s = suggest ? statusMap[suggest] : undefined;
    if (s && current && s.sort_order > current.sort_order) setNewStatus(s.key);
    else setNewStatus("");
  }

  function save() {
    if (!outcome) return;
    setError(null);
    const due = resolveFollowUp(followUp);
    start(async () => {
      const res = await logCall({
        leadId: lead.id,
        outcome,
        notes,
        followUpAt: due ? due.toISOString() : null,
        newStatus: newStatus || null,
      });
      if (res.ok) {
        toast("Call logged");
        onClose();
      } else setError(res.error);
    });
  }

  const who = lead.contact_name && lead.company_name ? `${lead.contact_name} · ${lead.company_name}` : lead.contact_name || lead.company_name || "";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log Call"
      subtitle={who}
      footer={
        <>
          {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
          <PrimaryButton onClick={save} disabled={!outcome || pending}>
            {pending ? "Saving…" : outcome ? "Save Call" : "Pick an outcome"}
          </PrimaryButton>
        </>
      }
    >
      <p className="mb-4 text-xs font-medium text-navy-500">
        {formatDateTime(startedAt)}
        {me?.full_name ? ` · ${me.full_name}` : ""}
      </p>

      <SectionLabel>Outcome</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {CALL_OUTCOMES.map((o) => {
          const active = outcome === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => pickOutcome(o.key)}
              className={`min-h-[56px] rounded-md border-2 px-3 py-2 text-left text-[15px] font-semibold leading-tight ${
                active
                  ? "border-navy-950 bg-navy-950 text-white"
                  : "border-navy-200 bg-white text-navy-950 active:bg-navy-50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <SectionLabel>Notes</SectionLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What happened?"
          className="w-full rounded-md border-2 border-navy-200 bg-white px-3 py-2 text-base text-navy-950 placeholder:text-navy-300 focus:border-navy-700 focus:outline-none"
        />
      </div>

      <div className="mt-6">
        <SectionLabel>Next follow-up</SectionLabel>
        <FollowUpPicker value={followUp} onChange={setFollowUp} />
      </div>

      <div className="mt-6">
        <SectionLabel>Update status (optional)</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <StatusChip active={newStatus === ""} onClick={() => setNewStatus("")} dot={current ? STATUS_DOT[current.color] : undefined}>
            Keep: {current?.label ?? lead.status}
          </StatusChip>
          {activeStatuses
            .filter((s) => s.key !== lead.status)
            .map((s) => (
              <StatusChip key={s.key} active={newStatus === s.key} onClick={() => setNewStatus(s.key)} dot={STATUS_DOT[s.color]}>
                {s.label}
              </StatusChip>
            ))}
        </div>
      </div>
    </Sheet>
  );
}

function StatusChip({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-md border-2 px-3 text-sm font-semibold ${
        active ? "border-navy-950 bg-navy-950 text-white" : "border-navy-200 bg-white text-navy-900 active:bg-navy-50"
      }`}
    >
      {dot && <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />}
      {children}
    </button>
  );
}
