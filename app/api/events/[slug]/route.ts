import { getDb } from '@/lib/db';
import { isValidSlug } from '@/lib/server/validation';

// GET /api/events/[slug] — slug existence, active flag, and title.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: 'invalid_slug' }, { status: 400 });
  }
  const event = await getDb().getEventBySlug(slug);
  if (!event) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({
    slug: event.slug,
    title: event.title,
    description: event.description,
    isActive: event.isActive,
  });
}
