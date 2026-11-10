"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Bottom sheet on phones, centered dialog on desktop. */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-navy-950/60" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl md:max-w-lg md:rounded-xl">
        <div className="flex items-start gap-3 border-b border-navy-100 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-navy-950">{title}</h2>
            {subtitle && <p className="truncate text-sm text-navy-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-navy-500 active:bg-navy-50"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-navy-100 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-bold uppercase tracking-label text-navy-500">{children}</p>;
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-navy-950 text-base font-bold uppercase tracking-wider text-white active:bg-navy-800 disabled:bg-navy-200 disabled:text-navy-400"
    >
      {children}
    </button>
  );
}
