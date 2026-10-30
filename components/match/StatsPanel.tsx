'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MatchData } from '@/types/tennis.types';
import { shortName } from '@/lib/utils';
import { compareStat, shareOfTotal } from '@/lib/stats';

interface StatsPanelProps {
  match: MatchData;
}

interface StatRowProps {
  label: string;
  home: number;
  away: number;
  lowerIsBetter?: boolean;
  formatHome?: (v: number) => string;
  formatAway?: (v: number) => string;
  isPercentage?: boolean;
}

function StatRow({
  label,
  home,
  away,
  lowerIsBetter = false,
  formatHome = String,
  formatAway = String,
  isPercentage = false,
}: StatRowProps) {
  const better = compareStat(home, away, lowerIsBetter);
  const homeBetter = better === 'home';
  const awayBetter = better === 'away';

  // Progress bar values (relative to each other for visual comparison)
  const [p1, p2] = shareOfTotal(home, away);
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
          formatHome={() => `${home.breakPointsWon}/${home.breakPointsTotal}`}
          formatAway={() => `${away.breakPointsWon}/${away.breakPointsTotal}`}
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
