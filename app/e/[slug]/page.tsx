import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { isValidSlug } from "@/lib/server/validation";
import EventClient from "@/components/EventClient";

type Params = { params: Promise<{ slug: string }> };

// Always read the event's live state (incl. isActive) from the DB per request —
// never serve a cached/stale snapshot after an admin toggles the event.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return { title: "RULE SLOT" };
  const event = await getDb().getEventBySlug(slug);
  if (!event) return { title: "RULE SLOT" };
  return { title: `RULE SLOT | ${event.title}` };
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const event = await getDb().getEventBySlug(slug);
  if (!event) notFound();

  return <EventClient slug={event.slug} isActive={event.isActive} />;
}
