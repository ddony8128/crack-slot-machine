/** POST /api/feedback — submit a review/feedback (login required). Returns the
 *  error code string on failure (e.g. 'login_required'), or null on success. */
export async function submitFeedback(input: {
  body: string;
  rating?: number | null;
}): Promise<string | null> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return typeof data.error === "string" ? data.error : `http_${res.status}`;
  } catch {
    return "network_error";
  }
}
