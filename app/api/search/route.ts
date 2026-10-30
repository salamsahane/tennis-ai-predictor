import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { searchLiveMatches } from '@/services/tennis/sportradar.client';
import { redis, isRealRedis } from '@/lib/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Rate limiting (10 requests per minute) - only if using Upstash Redis
let ratelimit: Ratelimit | null = null;

const searchSchema = z.object({
  q: z.string().min(3).max(100).trim(),
});

export async function GET(request: NextRequest) {
  try {
    // 1. Rate limiting
    if (isRealRedis() && !ratelimit) {
      // Create ratelimit instance lazily to ensure redis is initialized
      ratelimit = new Ratelimit({
        redis: redis as any, // Cast because Upstash Ratelimit expects its own Redis type
        limiter: Ratelimit.slidingWindow(10, '1m'),
        analytics: false,
      });
    }

    if (ratelimit) {
      const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
      const { success } = await ratelimit.limit(`ratelimit:search:${ip}`);
      if (!success) {
        return Response.json({ error: 'Too many requests' }, { status: 429 });
      }
    }

    // 2. Validate input
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';

    const validationResult = searchSchema.safeParse({ q });
    if (!validationResult.success) {
      return Response.json(
        { error: 'Query must be between 3 and 100 characters' },
        { status: 400 }
      );
    }

    // 3. Search matches
    const query = validationResult.data.q;
    const matches = await searchLiveMatches(query);

    return Response.json({
      matches,
      total: matches.length,
    });
  } catch (error) {
    console.error('[API] Search failed:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
