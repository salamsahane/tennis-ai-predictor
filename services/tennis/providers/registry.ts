import type { MatchData, MatchSearchResult } from '@/types/tennis.types';
import { logProviderError, ProviderError, toProviderError } from './errors';
import { isHealthy, reportFailure, reportSuccess } from './health';
import { recordSnapshot } from './recorder';
import { createReplayProvider } from './replay.provider';
import { sportradarProvider } from './sportradar.provider';
import type { TennisDataProvider } from './types';

export interface Registry {
  listLiveMatches(): Promise<{ matches: MatchSearchResult[]; unavailableSources: string[] }>;
  getMatchById(matchId: string): Promise<MatchData | null>;
}

const KNOWN_PROVIDER_IDS = ['sportradar', 'apitennis', 'replay'];

function splitMatchId(matchId: string): { providerId: string; nativeId: string } {
  const i = matchId.indexOf(':');
  if (i <= 0) {
    throw new ProviderError('registry', 'not_found', 'Malformed match id');
  }
  return { providerId: matchId.slice(0, i), nativeId: matchId.slice(i + 1) };
}

export function parseMatchId(matchId: string): { providerId: string; nativeId: string } {
  const parsed = splitMatchId(matchId);
  if (!KNOWN_PROVIDER_IDS.includes(parsed.providerId)) {
    throw new ProviderError('registry', 'not_found', 'Unknown provider');
  }
  return parsed;
}

// Health is advisory: a Redis outage must never break matches or hide errors.
async function bestEffort(what: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    console.warn(`[Registry] health ${what} failed`);
  }
}

export function createRegistry(providers: TennisDataProvider[]): Registry {
  const byId = new Map(providers.map((p) => [p.id, p]));

  return {
    async listLiveMatches() {
      const matches: MatchSearchResult[] = [];
      const unavailableSources: string[] = [];
      let liveDone = false;

      for (const p of providers) {
        if (p.kind !== 'live' || liveDone) continue;
        try {
          let healthy = true;
          try {
            healthy = await isHealthy(p.id);
          } catch {
            console.warn('[Registry] health check failed, assuming healthy');
          }
          if (!healthy) {
            unavailableSources.push(p.label);
            continue;
          }
          const result = await p.listLiveMatches();
          await bestEffort('reportSuccess', () => reportSuccess(p.id));
          matches.push(...result);
          liveDone = true;
        } catch (err) {
          const e = toProviderError(p.id, err);
          await bestEffort('reportFailure', () => reportFailure(e));
          logProviderError(e);
          unavailableSources.push(p.label);
        }
      }

      for (const p of providers) {
        if (p.kind !== 'replay') continue;
        try {
          matches.push(...(await p.listLiveMatches()));
        } catch (err) {
          logProviderError(toProviderError(p.id, err));
        }
      }

      return { matches, unavailableSources };
    },

    async getMatchById(matchId) {
      let providerId: string;
      let nativeId: string;
      let provider: TennisDataProvider | undefined;
      try {
        ({ providerId, nativeId } = splitMatchId(matchId));
        provider = byId.get(providerId);
        if (!provider) throw new ProviderError('registry', 'not_found', 'Unknown provider');
      } catch {
        return null;
      }

      try {
        const data = await provider.getMatch(nativeId);
        await bestEffort('reportSuccess', () => reportSuccess(provider.id));
        if (data && provider.kind === 'live') await recordSnapshot(matchId, data);
        return data;
      } catch (err) {
        const e = toProviderError(provider.id, err);
        await bestEffort('reportFailure', () => reportFailure(e));
        if (e.kind === 'not_found') return null;
        throw e;
      }
    },
  };
}

const factories: Record<string, () => TennisDataProvider> = {
  sportradar: () => sportradarProvider,
  replay: () => createReplayProvider(),
};

function buildDefaultProviders(): TennisDataProvider[] {
  const ids = (process.env.TENNIS_PROVIDERS ?? 'sportradar,apitennis,replay')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.flatMap((id) => (factories[id] ? [factories[id]()] : []));
}

let defaultRegistry: Registry | undefined;
function getDefault(): Registry {
  return (defaultRegistry ??= createRegistry(buildDefaultProviders()));
}

export const registry: Registry = {
  listLiveMatches: () => getDefault().listLiveMatches(),
  getMatchById: (id) => getDefault().getMatchById(id),
};
