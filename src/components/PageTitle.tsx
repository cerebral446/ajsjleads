export function PageTitle({ title, kicker, right }: { title: string; kicker?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {kicker && <p className="text-[11px] font-bold uppercase tracking-label text-navy-500">{kicker}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-950">{title}</h1>
      </div>
      {right}
    </div>
  );
}
