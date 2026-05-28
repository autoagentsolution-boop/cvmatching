import { NextResponse } from 'next/server';
import { readVisitStats } from '@/lib/analytics/visit-counter';

export const runtime = 'nodejs';

export async function GET() {
  const stats = await readVisitStats();
  return NextResponse.json(stats, {
    headers: {
      // Cache at the edge for 30s to soften hot-reload load on KV.
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
