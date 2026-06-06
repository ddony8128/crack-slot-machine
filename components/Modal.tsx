"use client";

import { useEffect, useRef } from "react";

/**
 * Generic accessible modal dialog mirroring ReferenceModal's overlay markup:
 * dark backdrop (Esc / backdrop-click to close), centered panel, body-scroll
 * lock while open. Used by the intro instructions modal and the rule-placement
 * confirmation modals.
 */
export default function Modal({
  open,
  onClose,
  ariaLabel,
  children,
  maxWidthClass = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the dialog for accessibility.
    panelRef.current?.focus();
    // Prevent background scroll while open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`panel-pop relative flex max-h-[88vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
