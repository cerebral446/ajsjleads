import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[11px] font-bold uppercase tracking-label text-navy-500">Not found</p>
      <h1 className="text-2xl font-extrabold text-navy-950">That lead doesn&apos;t exist</h1>
      <Link href="/leads" className="h-12 rounded-md bg-navy-950 px-5 text-sm font-bold uppercase leading-[3rem] tracking-wider text-white">
        Back to leads
      </Link>
    </main>
  );
}
