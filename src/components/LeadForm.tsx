"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Lead, LeadInput, LeadSource, LeadStatus, Profile } from "@/lib/types";
import { createLead, updateLead, deleteLead } from "@/app/actions";
import { useToast } from "./Toast";
import { SectionLabel, PrimaryButton } from "./Sheet";
import { FollowUpPicker, resolveFollowUp, type FollowUpChoice } from "./FollowUpPicker";

const input =
  "h-12 w-full rounded-md border-2 border-navy-200 bg-white px-3 text-base text-navy-950 placeholder:text-navy-300 focus:border-navy-700 focus:outline-none";

export function LeadForm({
  lead,
  statuses,
  sources,
  profiles,
  meId,
}: {
  lead?: Lead;
  statuses: LeadStatus[];
  sources: LeadSource[];
  profiles: Profile[];
  meId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<FollowUpChoice>({ kind: "none" });
  const [v, setV] = useState<LeadInput>({
    company_name: lead?.company_name ?? "",
    contact_name: lead?.contact_name ?? "",
    job_title: lead?.job_title ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    website: lead?.website ?? "",
    location: lead?.location ?? "",
    source: lead?.source ?? "",
    status: lead?.status ?? "new_lead",
    notes: lead?.notes ?? "",
    assigned_to: lead?.assigned_to ?? meId,
  });
  const set = (k: keyof LeadInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      if (lead) {
        const res = await updateLead(lead.id, v);
        if (!res.ok) return setError(res.error);
        toast("Lead saved");
        router.push(`/leads/${lead.id}`);
      } else {
        const due = resolveFollowUp(followUp);
        const res = await createLead(v, due ? due.toISOString() : null);
        if (!res.ok) return setError(res.error);
        toast("Lead added");
        router.push(`/leads/${res.data!.id}`);
      }
    });
  }

  function remove() {
    if (!lead) return;
    if (!confirm("Delete this lead and its full history? This cannot be undone.")) return;
    start(async () => {
      const res = await deleteLead(lead.id);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-4">
      <fieldset className="space-y-4">
        <Field label="Company name">
          <input className={input} value={v.company_name} onChange={set("company_name")} placeholder="e.g. Ridgeline Homes" autoComplete="organization" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name">
            <input className={input} value={v.contact_name} onChange={set("contact_name")} placeholder="First Last" autoComplete="name" />
          </Field>
          <Field label="Job title / position">
            <input className={input} value={v.job_title} onChange={set("job_title")} placeholder="Purchasing Manager" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input className={input} type="tel" inputMode="tel" value={v.phone} onChange={set("phone")} placeholder="(555) 555-5555" autoComplete="tel" />
          </Field>
          <Field label="Email">
            <input className={input} type="email" inputMode="email" value={v.email} onChange={set("email")} placeholder="name@company.com" autoComplete="email" autoCapitalize="none" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website">
            <input className={input} inputMode="url" value={v.website} onChange={set("website")} placeholder="company.com" autoCapitalize="none" />
          </Field>
          <Field label="Location / service area">
            <input className={input} value={v.location} onChange={set("location")} placeholder="City, county or region" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <Field label="Status">
          <select className={input} value={v.status} onChange={set("status")}>
            {statuses
              .filter((s) => s.is_active || s.key === v.status)
              .map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Lead source">
          <select className={input} value={v.source} onChange={set("source")}>
            <option value="">—</option>
            {sources
              .filter((s) => s.is_active || s.key === v.source)
              .map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Assigned to">
          <select className={input} value={v.assigned_to} onChange={set("assigned_to")}>
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <Field label="Notes">
        <textarea
          className={`${input} h-auto py-2`}
          rows={4}
          value={v.notes}
          onChange={set("notes")}
          placeholder="Trades they use, project types, gatekeeper names…"
        />
      </Field>

      {!lead && (
        <div>
          <SectionLabel>First follow-up</SectionLabel>
          <FollowUpPicker value={followUp} onChange={setFollowUp} />
        </div>
      )}

      {error && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+76px)] z-10 md:bottom-4">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Saving…" : lead ? "Save Changes" : "Add Lead"}
        </PrimaryButton>
      </div>

      {lead && (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="h-12 w-full rounded-md text-sm font-bold uppercase tracking-wider text-red-700 active:bg-red-50"
        >
          Delete lead
        </button>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-label text-navy-500">{label}</span>
      {children}
    </label>
  );
}
