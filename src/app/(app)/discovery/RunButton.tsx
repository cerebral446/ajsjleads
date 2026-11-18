"use client";

import { useFormStatus } from "react-dom";

export function RunButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-md bg-navy-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
    {pending ? "Discovery running…" : "Run Discovery"}
  </button>;
}
