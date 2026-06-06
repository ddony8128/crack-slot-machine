import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb, TOTAL_SLUG } from "@/lib/db";
import { isValidSlug } from "@/lib/server/validation";
import LeaderboardView from "@/components/LeaderboardView";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return { title: "RULE SLOT" };
  const event = await getDb().getEventBySlug(slug);
  return { title: event ? `RULE SLOT | ${event.title} 랭킹` : "RULE SLOT" };
}

export default async function LeaderboardPage({ params }: Params) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const event = await getDb().getEventBySlug(slug);
  if (!event) notFound();

  const isTotal = slug === TOTAL_SLUG;
  return (
    <LeaderboardView slug={event.slug} title={event.title} isTotal={isTotal} />
  );
}
