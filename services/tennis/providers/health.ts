import { redis } from '@/lib/redis';
import type { ProviderError } from './errors';

const AUTH_COOLDOWN_MS = 3_600_000;
const RATE_LIMIT_DEFAULT_MS = 60_000;
const TRANSIENT_COOLDOWN_MS = 15_000;
const TRANSIENT_THRESHOLD = 3;
const FAILURES_TTL_SECONDS = 300;

const downKey = (id: string) => `provider:${id}:down_until`;
const failuresKey = (id: string) => `provider:${id}:failures`;

async function markDown(id: string, cooldownMs: number): Promise<void> {
  await redis.set(downKey(id), String(Date.now() + cooldownMs), {
    ex: Math.ceil(cooldownMs / 1000) + 1,
  });
}

export async function isHealthy(providerId: string): Promise<boolean> {
  const raw = await redis.get(downKey(providerId));
  if (raw === null || raw === undefined) return true;
  const downUntil = Number(raw);
  if (!Number.isFinite(downUntil)) return true;
  return Date.now() >= downUntil;
}

export async function reportFailure(e: ProviderError): Promise<void> {
  const id = e.providerId;
  switch (e.kind) {
    case 'auth':
      await markDown(id, AUTH_COOLDOWN_MS);
      return;
    case 'rate_limit':
      await markDown(id, e.retryAfterMs ?? RATE_LIMIT_DEFAULT_MS);
      return;
    case 'transient': {
      const prev = Number(await redis.get(failuresKey(id))) || 0;
      const count = prev + 1;
      if (count >= TRANSIENT_THRESHOLD) {
        await redis.del(failuresKey(id));
        await markDown(id, TRANSIENT_COOLDOWN_MS);
      } else {
        await redis.set(failuresKey(id), String(count), { ex: FAILURES_TTL_SECONDS });
      }
      return;
    }
    case 'not_found':
      return;
  }
}

export async function reportSuccess(providerId: string): Promise<void> {
  await redis.del(failuresKey(providerId));
}
