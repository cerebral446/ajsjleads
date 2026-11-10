import type { LeadStatus } from "@/lib/types";

// Full class strings so Tailwind keeps them. Add a color here to use it in lead_statuses.color.
const BADGE: Record<string, string> = {
  blue: "bg-blue-100 text-blue-900 ring-blue-300",
  slate: "bg-slate-200 text-slate-800 ring-slate-400",
  gray: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  cyan: "bg-cyan-100 text-cyan-900 ring-cyan-400",
  amber: "bg-amber-100 text-amber-900 ring-amber-400",
  emerald: "bg-emerald-100 text-emerald-900 ring-emerald-400",
  violet: "bg-violet-100 text-violet-900 ring-violet-300",
  orange: "bg-orange-100 text-orange-900 ring-orange-400",
  teal: "bg-teal-100 text-teal-900 ring-teal-400",
  green: "bg-green-700 text-white ring-green-800",
  stone: "bg-stone-200 text-stone-600 ring-stone-300",
  red: "bg-red-600 text-white ring-red-700",
};

export const STATUS_DOT: Record<string, string> = {
  blue: "bg-blue-500",
  slate: "bg-slate-500",
  gray: "bg-zinc-400",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  green: "bg-green-700",
  stone: "bg-stone-400",
  red: "bg-red-600",
};

export function StatusBadge({
  status,
  statusKey,
  size = "sm",
}: {
  status?: LeadStatus;
  statusKey?: string;
  size?: "sm" | "md";
}) {
  const label = status?.label ?? statusKey?.replace(/_/g, " ") ?? "—";
  const cls = BADGE[status?.color ?? "slate"] ?? BADGE.slate;
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[3px] font-semibold uppercase ring-1 ring-inset ${cls} ${
        size === "md" ? "px-2.5 py-1 text-xs tracking-wider" : "px-2 py-0.5 text-[11px] tracking-wide"
      }`}
    >
      {label}
    </span>
  );
}
