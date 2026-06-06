"use client";

import Modal from "@/components/Modal";

/**
 * Generic confirmation modal: a message plus confirm / cancel buttons.
 * Used for rule-placement confirmation in RuleSlots.
 */
export default function ConfirmModal({
  open,
  message,
  confirmLabel,
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} ariaLabel="규칙 배치 확인">
      <div className="px-5 py-5">
        <p className="text-sm leading-relaxed text-zinc-100">{message}</p>
      </div>
      <footer className="flex gap-3 border-t border-zinc-800 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          {confirmLabel}
        </button>
      </footer>
    </Modal>
  );
}
