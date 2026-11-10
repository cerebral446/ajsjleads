"use client";

import { useMemo, useState } from "react";
import { QUICK_FOLLOW_UPS, FOLLOW_UP_DEFAULT_HOUR } from "@/lib/options";
import { daysFromNowAt, formatDateTime, fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import { CalendarClock } from "lucide-react";

export type FollowUpChoice = { kind: "none" } | { kind: "quick"; days: number } | { kind: "custom"; value: string };

export function resolveFollowUp(choice: FollowUpChoice): Date | null {
  if (choice.kind === "quick") return daysFromNowAt(choice.days, FOLLOW_UP_DEFAULT_HOUR);
  if (choice.kind === "custom") return fromLocalInputValue(choice.value);
  return null;
}

/** Chip row: None · Tomorrow · 2 Days · 3 Days · 1 Week · 2 Weeks · Custom */
export function FollowUpPicker({
  value,
  onChange,
  allowNone = true,
}: {
  value: FollowUpChoice;
  onChange: (c: FollowUpChoice) => void;
  allowNone?: boolean;
}) {
  const [customValue, setCustomValue] = useState(() => toLocalInputValue(daysFromNowAt(1, FOLLOW_UP_DEFAULT_HOUR)));
  const resolved = useMemo(() => resolveFollowUp(value), [value]);

  const chip = (active: boolean) =>
    `h-12 rounded-md border-2 px-3 text-sm font-semibold ${
      active ? "border-navy-950 bg-navy-950 text-white" : "border-navy-200 bg-white text-navy-900 active:bg-navy-50"
    }`;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {allowNone && (
          <button type="button" className={chip(value.kind === "none")} onClick={() => onChange({ kind: "none" })}>
            None
          </button>
        )}
        {QUICK_FOLLOW_UPS.map((q) => (
          <button
            key={q.days}
            type="button"
            className={chip(value.kind === "quick" && value.days === q.days)}
            onClick={() => onChange({ kind: "quick", days: q.days })}
          >
            {q.label}
          </button>
        ))}
        <button
          type="button"
          className={chip(value.kind === "custom")}
          onClick={() => onChange({ kind: "custom", value: customValue })}
        >
          Custom
        </button>
      </div>

      {value.kind === "custom" && (
        <input
          type="datetime-local"
          value={value.value}
          onChange={(e) => {
            setCustomValue(e.target.value);
            onChange({ kind: "custom", value: e.target.value });
          }}
          className="mt-3 h-12 w-full rounded-md border-2 border-navy-200 bg-white px-3 text-base text-navy-950 focus:border-navy-700 focus:outline-none"
        />
      )}

      {resolved && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-navy-800">
          <CalendarClock className="h-4 w-4" />
          {formatDateTime(resolved)}
        </p>
      )}
    </div>
  );
}
