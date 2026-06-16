"use client";

import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/client/authApi";

/**
 * Opens the 후원(donation) modal ONCE per `storageKey`, the first time `when`
 * becomes true — but never for a supporter, and never twice (remembered in
 * localStorage under `rule-slot-donation-${storageKey}`).
 *
 * `isSupporter` may be passed by the caller; when left undefined the hook
 * fetches /api/auth/me to resolve it (skipping the prompt for supporters).
 *
 * Returns `{ open, close }`: wire `open` to <DonationModal open=… /> and
 * `close` to its onClose. Donation is purely cosmetic and never touches scoring.
 *
 * Reliability: the "already shown" localStorage key is written on CLOSE (first
 * dismissal), NOT on trigger. This guarantees the modal is actually seen before
 * it's suppressed — if `when` flickers true while the modal is never rendered
 * (a screen transition/unmount), nothing is persisted and the prompt can still
 * show later. The mount-time read of the key still gates against re-showing.
 */
export function useDonationPrompt({
  when,
  storageKey,
  isSupporter,
}: {
  when: boolean;
  storageKey: string;
  isSupporter?: boolean;
}): { open: boolean; close: () => void } {
  const [open, setOpen] = useState(false);
  const key = `rule-slot-donation-${storageKey}`;

  // Read the "already shown" flag once on mount so a prior dismissal gates the
  // prompt for the rest of this session (and re-reads aren't needed thereafter).
  const [alreadyShown, setAlreadyShown] = useState<boolean | null>(null);
  useEffect(() => {
    // Read the persisted flag once after mount (localStorage is unavailable
    // during SSR, so this can't be a lazy useState initializer). The synchronous
    // setState is intentional — we're syncing an external store into React.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlreadyShown(!!localStorage.getItem(key));
    } catch {
      // localStorage unavailable (private mode etc.) — treat as "skip" so we
      // never nag in an environment where we can't remember the dismissal.
      setAlreadyShown(true);
    }
  }, [key]);

  useEffect(() => {
    if (!when) return;
    if (alreadyShown !== false) return; // not yet resolved, or already shown

    let cancelled = false;

    const trigger = (supporter: boolean) => {
      if (cancelled || supporter) return;
      // Do NOT write localStorage here — only open. The "shown" key is written
      // on close() so the modal is guaranteed to be seen before it's suppressed.
      setOpen(true);
    };

    if (isSupporter !== undefined) {
      trigger(isSupporter);
    } else {
      // Resolve supporter status; treat fetch failures as "not a supporter"
      // so the prompt still shows (donation never gates anything).
      fetchMe()
        .then((me) => trigger(me.supporterBadge))
        .catch(() => trigger(false));
    }

    return () => {
      cancelled = true;
    };
  }, [when, key, isSupporter, alreadyShown]);

  const close = () => {
    setOpen(false);
    // Persist the dismissal so the prompt never shows again for this key.
    try {
      localStorage.setItem(key, "1");
    } catch {
      // ignore — worst case it shows again next time.
    }
    setAlreadyShown(true);
  };

  return { open, close };
}
