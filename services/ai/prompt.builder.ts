// services/ai/prompt.builder.ts
// Builds formatted prompts from match data for AI models

import { USER_PROMPT_TEMPLATE } from '@/constants/prompts';
import type { MatchData, PeriodScore } from '@/types/tennis.types';

/**
 * Build a human-readable score history from periodScores.
 * Example output:
 *   Set 1 : Djokovic 6 - 4 Alcaraz
 *   Set 2 : Alcaraz 7 - 6 Djokovic (tiebreak)
 *   Set 3 (en cours) : Djokovic 3 - 2 Alcaraz
 */
function buildScoreHistory(
  periodScores: PeriodScore[],
  homeName: string,
  awayName: string,
): string {
  if (periodScores.length === 0) {
    return '  Aucun set terminé pour le moment (début de match).';
  }

  return periodScores
    .map((set, idx) => {
      const isCurrentSet = idx === periodScores.length - 1;
      const label = isCurrentSet ? `Set ${set.number} (en cours)` : `Set ${set.number}`;
      const winner = set.home > set.away ? homeName : set.home < set.away ? awayName : 'Égalité';
      const score =
        set.home > set.away
          ? `${homeName} ${set.home} - ${set.away} ${awayName}`
          : `${awayName} ${set.away} - ${set.home} ${homeName}`;
      const tieBreakNote = set.tieBreak ? ' (tiebreak)' : '';
      return `  ${label} : ${score}${tieBreakNote}`;
    })
    .join('\n');
}

/**
 * Build a momentum/trend analysis from the match data.
 */
function buildMomentumAnalysis(matchData: MatchData): string {
  const { statistics, players, score } = matchData;
  const home = statistics.home;
  const away = statistics.away;
  const lines: string[] = [];

  // Recent form (last 10 points)
  const homeLast10 = home.pointsWonLast10;
  const awayLast10 = away.pointsWonLast10;
  if (homeLast10 > awayLast10) {
    lines.push(
      `- Momentum récent : ${players.home.name} domine les 10 derniers points (${homeLast10} vs ${awayLast10})`,
    );
  } else if (awayLast10 > homeLast10) {
    lines.push(
      `- Momentum récent : ${players.away.name} domine les 10 derniers points (${awayLast10} vs ${homeLast10})`,
    );
  } else {
    lines.push(
      `- Momentum récent : équilibré sur les 10 derniers points (${homeLast10}-${awayLast10})`,
    );
  }

  // Total points balance
  const totalHome = home.totalPointsWon;
  const totalAway = away.totalPointsWon;
  if (totalHome + totalAway > 0) {
    const homePct = Math.round((totalHome / (totalHome + totalAway)) * 100);
    lines.push(
      `- Balance globale des points : ${players.home.name} ${homePct}% - ${100 - homePct}% ${players.away.name}`,
    );
  }

  // Winners vs Unforced errors ratio
  const homeRatio = home.winners - home.unforcedErrors;
  const awayRatio = away.winners - away.unforcedErrors;
  lines.push(
    `- Ratio Winners-Fautes : ${players.home.name} ${homeRatio >= 0 ? '+' : ''}${homeRatio} | ${players.away.name} ${awayRatio >= 0 ? '+' : ''}${awayRatio}`,
  );

  // Break points pressure
  if (home.breakPointsTotal > 0 || away.breakPointsTotal > 0) {
    const homeBpPct =
      home.breakPointsTotal > 0
        ? Math.round((home.breakPointsWon / home.breakPointsTotal) * 100)
        : 0;
    const awayBpPct =
      away.breakPointsTotal > 0
        ? Math.round((away.breakPointsWon / away.breakPointsTotal) * 100)
        : 0;
    lines.push(
      `- Conversion en break : ${players.home.name} ${homeBpPct}% (${home.breakPointsWon}/${home.breakPointsTotal}) | ${players.away.name} ${awayBpPct}% (${away.breakPointsWon}/${away.breakPointsTotal})`,
    );
  }

  // Set progression trend
  const periodScores = score.periodScores;
  if (periodScores.length >= 2) {
    const lastCompleted = periodScores[periodScores.length - 2];
    const current = periodScores[periodScores.length - 1];
    if (lastCompleted && current) {
      const prevWinner =
        lastCompleted.home > lastCompleted.away ? players.home.name : players.away.name;
      const currentLeader =
        current.home > current.away
          ? players.home.name
          : current.away > current.home
            ? players.away.name
            : 'Aucun';
      lines.push(
        `- Dernier set gagné par : ${prevWinner} | Meneur du set actuel : ${currentLeader}`,
      );
    }
  }

  return lines.join('\n');
}

/**
 * Build a formatted prompt from match data using the template
 */
export function buildPrompt(matchData: MatchData): string {
  const { players, score, statistics, nextGame, tournament, surface } = matchData;

  const homeStats = statistics.home;
  const awayStats = statistics.away;
  const serverName = nextGame.server === 'home' ? players.home.name : players.away.name;
  const receiverName = nextGame.server === 'home' ? players.away.name : players.home.name;

  const currentSetNumber = score.periodScores.length || 1;
  const totalGamesPlayed = score.periodScores.reduce((sum, set) => sum + set.home + set.away, 0);

  // Build dynamic sections
  const scoreHistory = buildScoreHistory(score.periodScores, players.home.name, players.away.name);
  const momentumAnalysis = buildMomentumAnalysis(matchData);

  // Tiebreak context
  const tiebreakInfo = score.currentGame.tieBreak
    ? '- ⚠️ TIEBREAK EN COURS dans le set actuel\n'
    : '';

  const replacements: Record<string, string | number> = {
    tournament_name: tournament,
    surface: surface,
    current_set: `Set ${currentSetNumber}`,
    home_sets: score.sets.home,
    away_sets: score.sets.away,
    home_games: score.currentSet.home,
    away_games: score.currentSet.away,
    total_games_played: totalGamesPlayed,
    next_server: serverName,
    next_receiver: receiverName,
    next_game_number: nextGame.number,
    tiebreak_info: tiebreakInfo,

    // Dynamic sections
    score_history: scoreHistory,
    momentum_analysis: momentumAnalysis,

    // Home player stats
    player_home: players.home.name,
    aces_home: homeStats.aces,
    df_home: homeStats.doubleFaults,
    first_serve_in_home: homeStats.firstServePercentage,
    first_serve_won_home: homeStats.firstServePointsWon,
    second_serve_pct_home: homeStats.secondServePercentage,
    winners_home: homeStats.winners,
    ufe_home: homeStats.unforcedErrors,
    bp_won_home: homeStats.breakPointsWon,
    bp_total_home: homeStats.breakPointsTotal,
    last10_home: homeStats.pointsWonLast10,
    service_games_won_home: homeStats.serviceGamesWon,
    total_points_home: homeStats.totalPointsWon,
    return_points_home: homeStats.returnPointsWon,

    // Away player stats
    player_away: players.away.name,
    aces_away: awayStats.aces,
    df_away: awayStats.doubleFaults,
    first_serve_in_away: awayStats.firstServePercentage,
    first_serve_won_away: awayStats.firstServePointsWon,
    second_serve_pct_away: awayStats.secondServePercentage,
    winners_away: awayStats.winners,
    ufe_away: awayStats.unforcedErrors,
    bp_won_away: awayStats.breakPointsWon,
    bp_total_away: awayStats.breakPointsTotal,
    last10_away: awayStats.pointsWonLast10,
    service_games_won_away: awayStats.serviceGamesWon,
    total_points_away: awayStats.totalPointsWon,
    return_points_away: awayStats.returnPointsWon,
  };

  let prompt = USER_PROMPT_TEMPLATE;
  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }

  return prompt;
}
