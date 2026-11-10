"use client";

import { useEffect, useState, useTransition } from "react";
import { addNote } from "@/app/actions";
import { useToast } from "./Toast";
import { Sheet, PrimaryButton } from "./Sheet";

export function NoteSheet({
  leadId,
  subtitle,
  open,
  onClose,
}: {
  leadId: string;
  subtitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setError(null);
    }
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add Note"
      subtitle={subtitle}
      footer={
        <>
          {error && <p className="mb-2 text-sm font-semibold text-red-700">{error}</p>}
          <PrimaryButton
            disabled={!note.trim() || pending}
            onClick={() =>
              start(async () => {
                const res = await addNote(leadId, note);
                if (res.ok) {
                  toast("Note added");
                  onClose();
                } else setError(res.error);
              })
            }
          >
            {pending ? "Saving…" : "Save Note"}
          </PrimaryButton>
        </>
      }
    >
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={6}
        placeholder="Type a note…"
        className="w-full rounded-md border-2 border-navy-200 bg-white px-3 py-2 text-base text-navy-950 placeholder:text-navy-300 focus:border-navy-700 focus:outline-none"
      />
    </Sheet>
  );
}
