import fs from 'fs';
import path from 'path';
import type { MatchData, MatchSearchResult } from '@/types/tennis.types';
import type { SourceInfo, TennisDataProvider } from './types';

export interface Recording {
  id: string;
  label: string;
  players: { home: string; away: string };
  tournament: string;
  surface: MatchData['surface'];
  startedAt?: number;
  snapshots: Array<{ t: number; data: MatchData }>;
}

const SOURCE: SourceInfo = { providerId: 'replay', label: 'Replay', kind: 'replay' };
const PREFIX = 'replay:';

function loadRecordings(dir: string): Recording[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => {
        try {
          const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Recording;
          return Array.isArray(rec.snapshots) && rec.snapshots.length > 0 ? [rec] : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export function createReplayProvider(
  opts: { dir?: string; speed?: number; epoch?: number } = {},
): TennisDataProvider {
  const dir = path.resolve(process.cwd(), opts.dir ?? process.env.REPLAY_DIR ?? 'data/replays');
  const speed = opts.speed ?? (Number(process.env.REPLAY_SPEED) || 1);
  const epoch = opts.epoch ?? (Number(process.env.REPLAY_EPOCH) || 0);
  let cache: Recording[] | null = null;
  const recordings = () => (cache ??= loadRecordings(dir));

  function snapshotOf(rec: Recording): MatchData {
    const duration = rec.snapshots[rec.snapshots.length - 1].t;
    const position =
      duration > 0 ? ((((Date.now() - epoch) * speed) % duration) + duration) % duration : 0;
    let current = rec.snapshots[0];
    for (const s of rec.snapshots) if (s.t <= position) current = s;
    return { ...current.data, id: `${PREFIX}${rec.id}`, status: 'live', source: SOURCE };
  }

  return {
    id: SOURCE.providerId,
    label: SOURCE.label,
    kind: SOURCE.kind,
    async listLiveMatches(): Promise<MatchSearchResult[]> {
      return recordings().map((rec) => {
        const m = snapshotOf(rec);
        const last = m.score.periodScores[m.score.periodScores.length - 1];
        const score = last
          ? `${last.home}-${last.away} (Set ${m.score.periodScores.length})`
          : '0-0';
        return {
          id: m.id,
          status: 'live',
          tournament: rec.tournament,
          surface: rec.surface ?? 'unknown',
          home_player: rec.players.home,
          away_player: rec.players.away,
          score,
          source: SOURCE,
        };
      });
    },
    async getMatch(nativeId: string): Promise<MatchData | null> {
      const id = nativeId.startsWith(PREFIX) ? nativeId.slice(PREFIX.length) : nativeId;
      const rec = recordings().find((r) => r.id === id);
      return rec ? snapshotOf(rec) : null;
    },
  };
}
