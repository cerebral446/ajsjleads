"use client";

import { useEffect, useState, useTransition } from "react";
import { scheduleFollowUp, closeFollowUps } from "@/app/actions";
import { formatDateTime } from "@/lib/dates";
import { useToast } from "./Toast";
import { Sheet, SectionLabel, PrimaryButton } from "./Sheet";
import { FollowUpPicker, resolveFollowUp, type FollowUpChoice } from "./FollowUpPicker";

type LeadLite = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  next_follow_up_at: string | null;
};

export function FollowUpSheet({ lead, open, onClose }: { lead: LeadLite; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<FollowUpChoice>({ kind: "quick", days: 1 });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setChoice({ kind: "quick", days: 1 });
      setNote("");
      setError(null);
    }
  }, [open]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast(message);
        onClose();
      } else setError(res.error ?? "Something went wrong");
    });
  }

  const due = resolveFollowUp(choice);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Schedule Follow-Up"
      subtitle={lead.company_name || lead.contact_name || ""}
      footer={
        <>
          {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
          <PrimaryButton
            disabled={!due || pending}
            onClick={() => due && run(() => scheduleFollowUp(lead.id, due.toISOString(), note), "Follow-up scheduled")}
          >
            {pending ? "Saving…" : "Save Follow-Up"}
          </PrimaryButton>
        </>
      }
    >
      {lead.next_follow_up_at && (
        <div className="mb-5 rounded-md border-2 border-amber-300 bg-amber-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-label text-amber-800">Currently scheduled</p>
          <p className="mt-1 font-semibold text-navy-950">{formatDateTime(lead.next_follow_up_at)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => closeFollowUps(lead.id, "done"), "Marked done")}
              className="h-11 rounded-md bg-green-700 text-sm font-bold uppercase tracking-wide text-white active:bg-green-800"
            >
              Mark done
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => closeFollowUps(lead.id, "canceled"), "Follow-up cleared")}
              className="h-11 rounded-md border-2 border-navy-200 bg-white text-sm font-bold uppercase tracking-wide text-navy-800 active:bg-navy-50"
            >
              Clear
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-900">Saving a new date below replaces it.</p>
        </div>
      )}

      <SectionLabel>When</SectionLabel>
      <FollowUpPicker value={choice} onChange={setChoice} allowNone={false} />

      <div className="mt-6">
        <SectionLabel>Reminder note (optional)</SectionLabel>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Ask about spring projects"
          className="h-12 w-full rounded-md border-2 border-navy-200 bg-white px-3 text-base text-navy-950 placeholder:text-navy-300 focus:border-navy-700 focus:outline-none"
        />
      </div>
    </Sheet>
  );
}
