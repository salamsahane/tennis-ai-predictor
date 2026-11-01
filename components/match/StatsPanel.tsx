'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MatchData } from '@/types/tennis.types';
import { shortName } from '@/lib/utils';
import { compareStat, formatStat, shareOfTotal } from '@/lib/stats';

interface StatsPanelProps {
  match: MatchData;
}

interface StatRowProps {
  label: string;
  home: number | null;
  away: number | null;
  lowerIsBetter?: boolean;
  formatHome?: (v: number | null) => string;
  formatAway?: (v: number | null) => string;
  isPercentage?: boolean;
}

function formatBreakPoints(won: number | null, total: number | null): string {
  return won === null || total === null ? 'n/d' : `${won}/${total}`;
}

function StatRow({
  label,
  home,
  away,
  lowerIsBetter = false,
  formatHome = (v) => formatStat(v),
  formatAway = (v) => formatStat(v),
  isPercentage = false,
}: StatRowProps) {
  // Nothing to compare when neither provider supplied this stat.
  if (home === null && away === null) return null;

  // A missing value counts as 0 for the comparison and the bar, but the cell shows n/d.
  const homeValue = home ?? 0;
  const awayValue = away ?? 0;
  const better = compareStat(homeValue, awayValue, lowerIsBetter);
  const homeBetter = better === 'home';
  const awayBetter = better === 'away';

  // Progress bar values (relative to each other for visual comparison)
  const [p1, p2] = shareOfTotal(homeValue, awayValue);
  const suffix = isPercentage ? '%' : '';

  return (
    <div className="border-border/50 hover:bg-muted/10 flex flex-col rounded-sm border-b px-2 py-3 transition-colors last:border-0">
      <div className="mb-1 flex justify-between text-sm">
        <span
          className={`font-mono ${homeBetter ? 'text-primary font-bold' : 'text-muted-foreground'}`}
        >
          {formatHome(home)}
          {suffix}
        </span>
        <span className="text-foreground/80 font-medium">{label}</span>
        <span
          className={`font-mono ${awayBetter ? 'text-primary font-bold' : 'text-muted-foreground'}`}
        >
          {formatAway(away)}
          {suffix}
        </span>
      </div>
      <div className="flex h-1.5 w-full items-center gap-2">
        <div className="flex h-full flex-1 justify-end">
          <div
            className={`h-full rounded-l-full ${homeBetter ? 'bg-primary' : 'bg-muted'}`}
            style={{ width: `${p1}%` }}
          />
        </div>
        <div className="flex h-full flex-1 justify-start">
          <div
            className={`h-full rounded-r-full ${awayBetter ? 'bg-primary' : 'bg-muted'}`}
            style={{ width: `${p2}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function StatsPanel({ match }: StatsPanelProps) {
  const { players, statistics } = match;
  const home = statistics.home;
  const away = statistics.away;

  return (
    <Card className="border-border bg-card/50 shadow-lg backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between text-lg">
          <span className="text-muted-foreground">{shortName(players.home.name)}</span>
          <span className="text-primary/70 text-xs tracking-widest uppercase">Statistiques</span>
          <span className="text-muted-foreground">{shortName(players.away.name)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-4">
        <StatRow label="Aces" home={home.aces} away={away.aces} />
        <StatRow
          label="Double fautes"
          home={home.doubleFaults}
          away={away.doubleFaults}
          lowerIsBetter
        />
        <StatRow
          label="1er service réussi"
          home={home.firstServePercentage}
          away={away.firstServePercentage}
          isPercentage
        />
        <StatRow
          label="Pts gagnés s/ 1er serv."
          home={home.firstServePointsWon}
          away={away.firstServePointsWon}
          isPercentage
        />
        <StatRow
          label="Pts gagnés s/ 2e serv."
          home={home.secondServePointsWon}
          away={away.secondServePointsWon}
          isPercentage
        />
        <StatRow label="Coups gagnants" home={home.winners} away={away.winners} />
        <StatRow
          label="Fautes directes"
          home={home.unforcedErrors}
          away={away.unforcedErrors}
          lowerIsBetter
        />
        <StatRow
          label="Balles de break"
          home={home.breakPointsWon}
          away={away.breakPointsWon}
          formatHome={(v) => formatBreakPoints(v, home.breakPointsTotal)}
          formatAway={(v) => formatBreakPoints(v, away.breakPointsTotal)}
        />
        <StatRow
          label="Pts gagnés (10 dern.)"
          home={home.pointsWonLast10}
          away={away.pointsWonLast10}
        />
      </CardContent>
    </Card>
  );
}
