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

  useEffect(() => {
    if (!when) return;

    let cancelled = false;

    // Already shown for this key → never again.
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // localStorage unavailable (private mode etc.) — just skip the prompt.
      return;
    }

    const trigger = (supporter: boolean) => {
      if (cancelled || supporter) return;
      try {
        localStorage.setItem(key, "1");
      } catch {
        // ignore — worst case it shows again next time.
      }
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
  }, [when, key, isSupporter]);

  return { open, close: () => setOpen(false) };
}
