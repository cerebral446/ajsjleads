import { PhoneCall, StickyNote, CalendarPlus, CalendarCheck, CalendarX, Flag, Plus } from "lucide-react";
import type { Activity, LeadStatus } from "@/lib/types";
import { formatDate, formatTime, formatShortDate } from "@/lib/dates";
import { outcomeLabel } from "@/lib/options";

type Described = { icon: typeof PhoneCall; tone: string; title: string; lines: string[] };

function describe(a: Activity, contact: string, statuses: Record<string, LeadStatus>): Described {
  const label = (k?: string) => (k ? statuses[k]?.label ?? k : "");
  const fu = a.metadata?.follow_up_at ? `Follow-up scheduled for ${formatShortDate(a.metadata.follow_up_at)} at ${formatTime(a.metadata.follow_up_at)}.` : null;
  const statusLine = a.metadata?.status_to ? `Status → ${label(a.metadata.status_to)}` : null;

  switch (a.type) {
    case "call":
      return {
        icon: PhoneCall,
        tone: "bg-green-700 text-white",
        title: `Called ${contact}`,
        lines: [`Outcome: ${outcomeLabel(a.outcome)}`, statusLine, fu].filter(Boolean) as string[],
      };
    case "note":
      return { icon: StickyNote, tone: "bg-navy-700 text-white", title: "Note", lines: [] };
    case "follow_up":
      return { icon: CalendarPlus, tone: "bg-amber-500 text-navy-950", title: fu ?? "Follow-up scheduled", lines: [] };
    case "follow_up_done":
      return { icon: CalendarCheck, tone: "bg-green-100 text-green-800", title: "Follow-up marked done", lines: [] };
    case "follow_up_cleared":
      return { icon: CalendarX, tone: "bg-navy-100 text-navy-700", title: "Follow-up cleared", lines: [] };
    case "status_change":
      return {
        icon: Flag,
        tone: "bg-navy-100 text-navy-800",
        title: `Status changed to ${label(a.metadata?.status_to)}`,
        lines: a.metadata?.status_from ? [`Was: ${label(a.metadata.status_from)}`] : [],
      };
    case "created":
      return { icon: Plus, tone: "bg-navy-100 text-navy-800", title: "Lead added", lines: [] };
    default:
      return { icon: StickyNote, tone: "bg-navy-100 text-navy-800", title: a.type, lines: [] };
  }
}

export function Timeline({
  activities,
  contact,
  statuses,
}: {
  activities: Activity[];
  contact: string;
  statuses: Record<string, LeadStatus>;
}) {
  if (!activities.length) return <p className="text-sm text-navy-500">No activity yet.</p>;

  // Group by calendar day
  const groups: { day: string; items: Activity[] }[] = [];
  for (const a of activities) {
    const day = formatDate(a.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, items: [a] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.day}>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-label text-navy-500">{g.day}</h3>
          <ol className="relative space-y-4 border-l-2 border-navy-100 pl-6">
            {g.items.map((a) => {
              const d = describe(a, contact, statuses);
              const Icon = d.icon;
              return (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-[37px] top-0 flex h-7 w-7 items-center justify-center rounded-md ${d.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="font-bold leading-snug text-navy-950">{d.title}</p>
                  {d.lines.map((l) => (
                    <p key={l} className="text-[15px] text-navy-700">
                      {l}
                    </p>
                  ))}
                  {a.notes && <p className="mt-1 whitespace-pre-wrap text-[15px] italic text-navy-800">“{a.notes}”</p>}
                  <p className="mt-1 text-xs text-navy-400">
                    {formatTime(a.created_at)}
                    {a.author?.full_name ? ` · ${a.author.full_name}` : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
