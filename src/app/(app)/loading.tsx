export default function Loading() {
  return (
    <div className="animate-pulse space-y-3" aria-label="Loading">
      <div className="h-4 w-24 rounded bg-navy-100" />
      <div className="h-7 w-48 rounded bg-navy-100" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] rounded-md bg-navy-100/70" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-44 rounded-md bg-navy-100/60" />
      ))}
    </div>
  );
}
