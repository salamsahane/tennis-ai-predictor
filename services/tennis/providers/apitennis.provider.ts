// services/tennis/providers/apitennis.provider.ts
// api-tennis.com behind the TennisDataProvider interface

import axios from 'axios';
import type { MatchData, MatchSearchResult, PeriodScore, PlayerStats } from '@/types/tennis.types';
import { redis } from '@/lib/redis';
import { deriveStats, gameWinners, type GameRecord } from './derive-stats';
import { logProviderError, ProviderError, toProviderError } from './errors';
import type { SourceInfo, TennisDataProvider } from './types';

const ID = 'apitennis';
const BASE_URL = 'https://api.api-tennis.com/tennis/';
const SURFACE_TTL = 86_400; // seconds
const SOURCE: SourceInfo = { providerId: ID, label: 'api-tennis', kind: 'live' };

type Side = 'home' | 'away';

interface ApiScore {
  score_first: string;
  score_second: string;
  score_set: string;
}
interface ApiStat {
  player_key: number;
  stat_period: string;
  stat_name: string;
  stat_value: string | null;
  stat_won: number | null;
  stat_total: number | null;
}
interface ApiPoint {
  score: string;
}
interface ApiGame {
  set_number: string;
  number_game: string;
  player_served: string;
  serve_winner: string | null;
  points?: ApiPoint[];
}
interface ApiEvent {
  event_key: number;
  event_first_player: string;
  first_player_key: number;
  event_second_player: string;
  second_player_key: number;
  event_final_result?: string | null;
  event_game_result?: string | null;
  event_serve?: string | null;
  event_status?: string | null;
  event_live?: string | null;
  event_type_type?: string | null;
  tournament_name?: string | null;
  tournament_key?: number | null;
  scores?: ApiScore[];
  statistics?: ApiStat[];
  pointbypoint?: ApiGame[];
}

// How a stat is read: 'value' = the number in stat_value ("11", "69%"),
// 'percent' = stat_won / stat_total as a 0-100 integer (else stat_value),
// 'won' / 'total' = the raw counts.
type StatMode = 'value' | 'percent' | 'won' | 'total';
type StatTarget = [keyof PlayerStats, StatMode];

// Built from the stat_name values observed in a real get_livescore response.
// Observed but deliberately unmapped: Break Points Saved, 1st return points won,
// 2nd return points won, Service Points Won, Return games won, Total games won,
// Match points saved, Net points won. Everything else is null.
export const STAT_NAME_MAP: Record<string, StatTarget[]> = {
  Aces: [['aces', 'value']],
  'Double Faults': [['doubleFaults', 'value']],
  '1st serve percentage': [['firstServePercentage', 'percent']],
  '1st serve points won': [['firstServePointsWon', 'percent']],
  '2nd serve points won': [['secondServePointsWon', 'percent']],
  'Break Points Converted': [
    ['breakPointsWon', 'won'],
    ['breakPointsTotal', 'total'],
  ],
  'Return Points Won': [['returnPointsWon', 'won']],
  'Total Points Won': [['totalPointsWon', 'won']],
  'Last 10 balls': [['pointsWonLast10', 'value']],
  'Service games won': [['serviceGamesWon', 'won']],
  Winners: [['winners', 'value']],
  'Unforced errors': [['unforcedErrors', 'value']],
};

function emptyStats(): PlayerStats {
  return {
    aces: null,
    doubleFaults: null,
    firstServePercentage: null,
    firstServePointsWon: null,
    secondServePointsWon: null,
    secondServePercentage: null,
    winners: null,
    unforcedErrors: null,
    breakPointsWon: null,
    breakPointsTotal: null,
    pointsWonLast10: null,
    serviceGamesWon: null,
    gamesWon: null,
    totalPointsWon: null,
    returnPointsWon: null,
  };
}

function parseNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number.parseFloat(value.replace('%', ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function readStat(stat: ApiStat, mode: StatMode): number | null {
  switch (mode) {
    case 'won':
      return stat.stat_won ?? null;
    case 'total':
      return stat.stat_total ?? null;
    case 'percent':
      if (stat.stat_won != null && stat.stat_total) {
        return Math.round((stat.stat_won / stat.stat_total) * 100);
      }
      return parseNumber(stat.stat_value);
    default:
      return parseNumber(stat.stat_value);
  }
}

function mapStats(event: ApiEvent): { home: PlayerStats; away: PlayerStats } {
  const out = { home: emptyStats(), away: emptyStats() };
  for (const stat of event.statistics ?? []) {
    if (stat.stat_period !== 'match') continue; // skip per-set breakdowns
    const side: Side | null =
      stat.player_key === event.first_player_key
        ? 'home'
        : stat.player_key === event.second_player_key
          ? 'away'
          : null;
    const targets = STAT_NAME_MAP[stat.stat_name];
    if (!side || !targets) continue;
    for (const [field, mode] of targets) out[side][field] = readStat(stat, mode);
  }
  return out;
}

// --- point-by-point parsing ---------------------------------------------
// A game's `score` strings are cumulative ("15 - 0", "40 - 40", "A - 40"; tiebreak
// games use plain numbers). Each token maps to a rank (0/15/30/40 -> 0..3,
// A/AD -> 4, numbers as-is). The winner of a point is the side whose rank rose
// versus the previous point (the first point is compared with "0 - 0"). When
// that is not decisive (advantage falling back to deuce) the point goes to the
// side that did NOT hold advantage. The API omits the game-winning point, so it
// is appended and credited to `serve_winner`, unless the last listed score is
// already a finished tiebreak (>= 7 and a 2 point lead).

const RANKS: Record<string, number> = { '0': 0, '15': 1, '30': 2, '40': 3, A: 4, AD: 4 };

function rank(token: string): number {
  const t = token.trim().toUpperCase();
  return t in RANKS ? RANKS[t] : Number.parseInt(t, 10) || 0;
}

function parsePair(score: string): [number, number] {
  const [a = '0', b = '0'] = score.split('-');
  return [rank(a), rank(b)];
}

function isAdvantage(token: string): boolean {
  return /^A(D)?$/i.test(token.trim());
}

function sideOf(label: string | null | undefined): Side | null {
  if (label === 'First Player') return 'home';
  if (label === 'Second Player') return 'away';
  return null;
}

function pointWinners(game: ApiGame, winner: Side): Side[] {
  const winners: Side[] = [];
  let prevText = '0 - 0';
  let prev = parsePair(prevText);
  for (const point of game.points ?? []) {
    const cur = parsePair(point.score);
    const homeUp = cur[0] > prev[0];
    const awayUp = cur[1] > prev[1];
    if (homeUp && !awayUp) winners.push('home');
    else if (awayUp && !homeUp) winners.push('away');
    else {
      const [prevHome = ''] = prevText.split('-');
      const [, prevAway = ''] = prevText.split('-');
      winners.push(isAdvantage(prevHome) ? 'away' : isAdvantage(prevAway) ? 'home' : winner);
    }
    prevText = point.score;
    prev = cur;
  }
  const [h, a] = prev;
  const tiebreakDone = Math.max(h, a) >= 7 && Math.abs(h - a) >= 2;
  if (!tiebreakDone) winners.push(winner);
  return winners;
}

function toGameRecords(event: ApiEvent): GameRecord[] {
  const records: GameRecord[] = [];
  for (const game of event.pointbypoint ?? []) {
    const winner = sideOf(game.serve_winner);
    const server = sideOf(game.player_served);
    if (!winner || !server) continue; // game still in progress
    records.push({
      set: Number.parseInt(game.set_number.replace(/\D/g, ''), 10) || 1,
      game: Number.parseInt(game.number_game, 10) || records.length + 1,
      server,
      winner,
      pointWinners: pointWinners(game, winner),
    });
  }
  return records;
}

// --- score helpers ------------------------------------------------------

function pair(text: string | null | undefined): [string, string] {
  const [a, b] = (text ?? '').split('-').map((s) => s.trim());
  return [a || '0', b || '0'];
}

function gamePoint(token: string): string {
  return isAdvantage(token) ? 'AD' : token;
}

function periodScores(event: ApiEvent): PeriodScore[] {
  return (event.scores ?? []).map((s, i) => ({
    home: Number.parseInt(s.score_first, 10) || 0,
    away: Number.parseInt(s.score_second, 10) || 0,
    type: 'set' as const,
    number: Number.parseInt(s.score_set, 10) || i + 1,
  }));
}

function matchStatus(event: ApiEvent): MatchData['status'] {
  if (/finished|retired|walkover|cancelled|abandoned/i.test(event.event_status ?? '')) {
    return 'final';
  }
  return event.event_live === '1' ? 'live' : 'scheduled';
}

function normalizeSurface(raw: string | null | undefined): MatchData['surface'] {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('indoor')) return 'indoor';
  if (s.includes('clay')) return 'clay';
  if (s.includes('grass')) return 'grass';
  if (s.includes('hard')) return 'hard';
  return null;
}

// --- HTTP ---------------------------------------------------------------

async function request(params: Record<string, string>): Promise<unknown> {
  const key = process.env.APITENNIS_API_KEY;
  if (!key) throw new ProviderError(ID, 'auth', 'APITENNIS_API_KEY is not configured');

  let body: { success?: number | string; result?: unknown } | undefined;
  try {
    // The key travels in `params`; errors are mapped, never logged raw, because
    // axios errors embed the request URL.
    const res = await axios.get<typeof body>(BASE_URL, {
      params: { ...params, APIkey: key },
      timeout: 10000,
    });
    body = res.data;
  } catch (error) {
    const e = toProviderError(ID, error);
    logProviderError(e);
    throw e;
  }

  // Bad credentials come back as HTTP 200 with {"error":"1","result":[{"cod":1004,...}]}.
  if (!body || (body.success !== 1 && body.success !== '1')) {
    const e = new ProviderError(ID, 'auth', 'Provider rejected the request (success != 1)');
    logProviderError(e);
    throw e;
  }
  return body.result;
}

async function fetchSurface(
  tournamentKey: number | null | undefined,
): Promise<MatchData['surface']> {
  if (tournamentKey == null) return null;
  const cacheKey = `${ID}:surface:${tournamentKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (typeof cached === 'string') return normalizeSurface(cached);

    const result = (await request({
      method: 'get_draw',
      tournament_key: String(tournamentKey),
    })) as { tournament?: { tournament_surface?: string } } | undefined;
    const surface = normalizeSurface(result?.tournament?.tournament_surface);
    if (surface) await redis.set(cacheKey, surface, { ex: SURFACE_TTL });
    return surface;
  } catch {
    return null; // surface is optional; never fail the match over it
  }
}

// --- mapping ------------------------------------------------------------

function toMatchData(event: ApiEvent, surface: MatchData['surface']): MatchData {
  const periods = periodScores(event);
  const current = periods[periods.length - 1];
  const [sh, sa] = pair(event.event_final_result);
  const [gh, ga] = pair(event.event_game_result);
  const serving: Side = event.event_serve === 'Second Player' ? 'away' : 'home';

  const stats = mapStats(event);
  const records = toGameRecords(event);
  const derived = deriveStats(records);
  for (const side of ['home', 'away'] as const) {
    const s = stats[side];
    const d = derived[side];
    s.gamesWon = periods.reduce((sum, p) => sum + p[side], 0);
    // Derive only when point-by-point exists, so empty data stays null
    if (records.length > 0) {
      s.pointsWonLast10 ??= d.pointsWonLast10;
      s.totalPointsWon ??= d.totalPointsWon;
      s.serviceGamesWon ??= d.serviceGamesWon;
      s.returnPointsWon ??= d.returnPointsWon;
    }
  }

  return {
    id: `${ID}:${event.event_key}`,
    status: matchStatus(event),
    tournament: event.tournament_name || 'Unknown Tournament',
    surface,
    source: SOURCE,
    players: {
      home: { id: String(event.first_player_key), name: event.event_first_player, country: '' },
      away: { id: String(event.second_player_key), name: event.event_second_player, country: '' },
    },
    score: {
      sets: { home: Number.parseInt(sh, 10) || 0, away: Number.parseInt(sa, 10) || 0 },
      currentSet: { home: current?.home ?? 0, away: current?.away ?? 0 },
      currentGame: {
        home: gamePoint(gh),
        away: gamePoint(ga),
        tieBreak: current?.home === 6 && current?.away === 6,
      },
      periodScores: periods,
      serving,
    },
    statistics: stats,
    nextGame: {
      number: periods.reduce((sum, p) => sum + p.home + p.away, 0) + 1,
      server: serving,
    },
    gameWinners: gameWinners(records),
  };
}

function toSearchResult(event: ApiEvent): MatchSearchResult {
  const periods = periodScores(event);
  const last = periods[periods.length - 1];
  return {
    id: `${ID}:${event.event_key}`,
    status: matchStatus(event),
    tournament: event.tournament_name || 'Unknown Tournament',
    surface: 'unknown',
    home_player: event.event_first_player || 'Unknown',
    away_player: event.event_second_player || 'Unknown',
    score: last ? `${last.home}-${last.away} (Set ${periods.length})` : '0-0',
    source: SOURCE,
  };
}

function asEvents(result: unknown): ApiEvent[] {
  return Array.isArray(result) ? (result as ApiEvent[]) : [];
}

export const apitennisProvider: TennisDataProvider = {
  id: ID,
  label: SOURCE.label,
  kind: SOURCE.kind,

  async listLiveMatches(): Promise<MatchSearchResult[]> {
    const events = asEvents(await request({ method: 'get_livescore' }));
    return events.filter((e) => !/doubles/i.test(e.event_type_type ?? '')).map(toSearchResult);
  },

  async getMatch(nativeId: string): Promise<MatchData | null> {
    const events = asEvents(await request({ method: 'get_livescore', match_key: nativeId }));
    const event = events[0];
    if (!event) throw new ProviderError(ID, 'not_found', 'Match not found');
    return toMatchData(event, await fetchSurface(event.tournament_key));
  },
};
