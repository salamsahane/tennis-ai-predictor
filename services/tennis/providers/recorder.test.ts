import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchData } from '@/types/tennis.types';
import { recordSnapshot } from './recorder';
import type { Recording } from './replay.provider';

const demo = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'replays', 'demo-match.json'), 'utf8'),
) as Recording;
const data: MatchData = demo.snapshots[0].data;

describe('recordSnapshot', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is a no-op without RECORD_MATCHES', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
    await recordSnapshot('sr:match:1', data, { dir, now: 1000 });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('appends snapshots with relative t', async () => {
    vi.stubEnv('RECORD_MATCHES', '1');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
    await recordSnapshot('sr:match:1', data, { dir, now: 1000 });
    await recordSnapshot('sr:match:1', data, { dir, now: 4000 });
    const rec = JSON.parse(fs.readFileSync(path.join(dir, 'sr-match-1.json'), 'utf8')) as Recording;
    expect(rec.id).toBe('sr-match-1');
    expect(rec.label).toBe('Sinner, Jannik vs Alcaraz, Carlos');
    expect(rec.snapshots.map((s) => s.t)).toEqual([0, 3000]);
  });

  it('never throws on write failure', async () => {
    vi.stubEnv('RECORD_MATCHES', '1');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = path.join(os.tmpdir(), `blocker-${Date.now()}`);
    fs.writeFileSync(file, 'x');
    await expect(
      recordSnapshot('a', data, { dir: path.join(file, 'sub') }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
