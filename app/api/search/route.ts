import { type NextRequest } from 'next/server';
import type { Redis } from '@upstash/redis';
import { z } from 'zod';
import { registry } from '@/services/tennis/providers/registry';
import { filterMatches } from '@/lib/match-search';
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
        redis: redis as Redis, // Safe: isRealRedis() guarantees the Upstash client
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
        { status: 400 },
      );
    }

    // 3. Search matches
    const query = validationResult.data.q;
    const result = await registry.listLiveMatches();
    const matches = filterMatches(result.matches, query);

    return Response.json({
      matches,
      total: matches.length,
      unavailableSources: result.unavailableSources,
    });
  } catch (error) {
    console.error('[API] Search failed:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
