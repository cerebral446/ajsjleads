"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { LeadStatus } from "@/lib/types";

export type LeadFilterValues = {
  q: string;
  view: string; // all | overdue | today | not_contacted | contacted | recent
  status: string;
  company: string;
  followup: string; // any | today | week | month | none
  sort: string; // follow_up | recent | company | last_contact
};

export const QUICK_VIEWS = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due Today" },
  { key: "not_contacted", label: "Not Contacted" },
  { key: "contacted", label: "Contacted" },
  { key: "recent", label: "Added This Week" },
];

const select =
  "h-12 w-full rounded-md border-2 border-navy-200 bg-white px-3 text-base text-navy-950 focus:border-navy-700 focus:outline-none";

export function LeadFilters({
  values,
  statuses,
  companies,
}: {
  values: LeadFilterValues;
  statuses: LeadStatus[];
  companies: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  const [q, setQ] = useState(values.q);
  const [showMore, setShowMore] = useState(
    Boolean(values.status || values.company || (values.followup && values.followup !== "any") || (values.sort && values.sort !== "follow_up")),
  );
  const first = useRef(true);

  function push(next: Partial<LeadFilterValues>) {
    const merged = { ...values, q, ...next };
    const params = new URLSearchParams();
    for (const [k, val] of Object.entries(merged)) {
      if (!val) continue;
      if ((k === "view" && val === "all") || (k === "followup" && val === "any") || (k === "sort" && val === "follow_up")) continue;
      params.set(k, val);
    }
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounced search
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => push({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeExtra = [values.status, values.company, values.followup !== "any" && values.followup].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, name, phone, email, notes"
            className="h-12 w-full rounded-md border-2 border-navy-200 bg-white pl-10 pr-10 text-base text-navy-950 placeholder:text-navy-300 focus:border-navy-700 focus:outline-none"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-navy-400"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowMore((s) => !s)}
          className={`relative flex h-12 w-12 items-center justify-center rounded-md border-2 ${
            showMore ? "border-navy-950 bg-navy-950 text-white" : "border-navy-200 bg-white text-navy-800"
          }`}
          aria-label="More filters"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {activeExtra > 0 && (
            <span className="absolute -right-1.5 -top-1.5 h-5 min-w-[20px] rounded-full bg-amber-500 px-1 text-[11px] font-bold leading-5 text-navy-950">
              {activeExtra}
            </span>
          )}
        </button>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {QUICK_VIEWS.map((v) => {
          const active = (values.view || "all") === v.key;
          return (
            <button
              key={v.key}
              onClick={() => push({ view: v.key })}
              className={`h-10 shrink-0 rounded-md border-2 px-3.5 text-sm font-semibold ${
                active ? "border-navy-950 bg-navy-950 text-white" : "border-navy-200 bg-white text-navy-800"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {showMore && (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-navy-100 bg-white p-3">
          <label className="col-span-2 sm:col-span-1">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-label text-navy-500">Status</span>
            <select className={select} value={values.status} onChange={(e) => push({ status: e.target.value })}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 sm:col-span-1">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-label text-navy-500">Company</span>
            <select className={select} value={values.company} onChange={(e) => push({ company: e.target.value })}>
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-label text-navy-500">Follow-up</span>
            <select className={select} value={values.followup || "any"} onChange={(e) => push({ followup: e.target.value })}>
              <option value="any">Any</option>
              <option value="today">Today</option>
              <option value="week">Next 7 days</option>
              <option value="month">Next 30 days</option>
              <option value="none">None scheduled</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-label text-navy-500">Sort</span>
            <select className={select} value={values.sort || "follow_up"} onChange={(e) => push({ sort: e.target.value })}>
              <option value="follow_up">Next follow-up</option>
              <option value="recent">Newest added</option>
              <option value="last_contact">Last contacted</option>
              <option value="company">Company A–Z</option>
            </select>
          </label>
          {activeExtra > 0 && (
            <button
              onClick={() => push({ status: "", company: "", followup: "any", sort: "follow_up" })}
              className="col-span-2 h-11 text-sm font-bold uppercase tracking-wider text-navy-600"
            >
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
