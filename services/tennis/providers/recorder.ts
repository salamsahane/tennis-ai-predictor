import fs from 'fs';
import path from 'path';
import type { MatchData } from '@/types/tennis.types';
import type { Recording } from './replay.provider';

export async function recordSnapshot(
  matchId: string,
  data: MatchData,
  opts: { dir?: string; now?: number } = {},
): Promise<void> {
  if (process.env.RECORD_MATCHES !== '1') return;
  try {
    const dir = path.resolve(process.cwd(), opts.dir ?? process.env.REPLAY_DIR ?? 'data/replays');
    const now = opts.now ?? Date.now();
    const id = matchId.replace(/:/g, '-');
    const file = path.join(dir, `${id}.json`);
    fs.mkdirSync(dir, { recursive: true });
    let rec: Recording;
    if (fs.existsSync(file)) {
      rec = JSON.parse(fs.readFileSync(file, 'utf8')) as Recording;
    } else {
      rec = {
        id,
        label: `${data.players.home.name} vs ${data.players.away.name}`,
        players: { home: data.players.home.name, away: data.players.away.name },
        tournament: data.tournament,
        surface: data.surface,
        startedAt: now,
        snapshots: [],
      };
    }
    rec.snapshots.push({ t: now - (rec.startedAt ?? now), data });
    fs.writeFileSync(file, JSON.stringify(rec));
  } catch (err) {
    console.warn(
      `[Recorder] failed to record ${matchId}: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }
}
