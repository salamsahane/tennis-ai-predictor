// types/tennis.types.ts
// Core data types for tennis match data

export interface MatchData {
  id: string;
  status: 'live' | 'final' | 'scheduled';
  tournament: string;
  surface: 'clay' | 'hard' | 'grass' | 'indoor';
  players: {
    home: Player;
    away: Player;
  };
  score: {
    sets: { home: number; away: number };
    currentSet: SetScore;
    currentGame: GameScore;
    periodScores: PeriodScore[];
    serving: 'home' | 'away';
  };
  statistics: {
    home: PlayerStats;
    away: PlayerStats;
  };
  nextGame: {
    number: number;
    server: 'home' | 'away';
  };
}

export interface Player {
  id: string;
  name: string;
  country: string;
  seed?: number;
}

export interface SetScore {
  home: number;
  away: number;
}

export interface GameScore {
  home: string; // "0", "15", "30", "40", "AD"
  away: string;
  tieBreak: boolean;
}

export interface PeriodScore {
  home: number;
  away: number;
  type: 'set';
  number: number;
  tieBreak?: boolean;
}

export interface PlayerStats {
  aces: number;
  doubleFaults: number;
  firstServePercentage: number;
  firstServePointsWon: number;
  secondServePointsWon: number;
  secondServePercentage: number;
  winners: number;
  unforcedErrors: number;
  breakPointsWon: number;
  breakPointsTotal: number;
  pointsWonLast10: number;
  serviceGamesWon: number;
  gamesWon: number;
  totalPointsWon: number;
  returnPointsWon: number;
}

// SportRadar API response types
export interface SportRadarLiveSummaries {
  summaries: SportRadarSummary[];
}

export interface SportRadarSummary {
  sport_event: SportRadarSportEvent;
  sport_event_status: SportRadarStatus;
  statistics?: SportRadarStatistics;
}

export interface SportRadarSportEvent {
  id: string;
  tournament: {
    name: string;
  };
  competitors: {
    id: string;
    name: string;
    country_code: string;
    qualifier: 'home' | 'away';
    seed?: number;
  }[];
  venue?: {
    name: string;
    court_type?: string;
  };
}

export interface SportRadarStatus {
  status: 'live' | 'closed' | 'not_started';
  match_status: string;
  home_score: number;
  away_score: number;
  period_scores?: {
    home_score: number;
    away_score: number;
    type: string;
    number: number;
  }[];
  game_state?: {
    home_score: number | string;
    away_score: number | string;
    serving: 'home' | 'away';
    tie_break: boolean;
  };
}

export interface SportRadarStatistics {
  totals?: {
    competitors: {
      id: string;
      name: string;
      qualifier: 'home' | 'away';
      statistics: {
        aces?: number;
        double_faults?: number;
        first_serve_successful?: number;
        first_serve_total?: number;
        first_serve_points_won?: number;
        first_serve_points_total?: number;
        second_serve_points_won?: number;
        second_serve_points_total?: number;
        service_points_won?: number;
        breakpoints_won?: number;
        total_breakpoints?: number;
        forehand_winners?: number;
        backhand_winners?: number;
        forehand_unforced_errors?: number;
        backhand_unforced_errors?: number;
        points_won?: number;
        points_won_from_last_10?: number;
        service_games_won?: number;
        games_won?: number;
      };
    }[];
  };
}

// Search result type
export interface MatchSearchResult {
  id: string;
  status: 'live' | 'final' | 'scheduled';
  tournament: string;
  surface: string;
  home_player: string;
  away_player: string;
  score: string;
  venue?: string;
}
