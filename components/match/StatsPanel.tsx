'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MatchData } from '@/types/tennis.types';
import { shortName } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface StatsPanelProps {
  match: MatchData;
}

export function StatsPanel({ match }: StatsPanelProps) {
  const { players, statistics } = match;
  const home = statistics.home;
  const away = statistics.away;

  const StatRow = ({
    label,
    val1,
    val2,
    format = (v: number) => String(v),
    isPercentage = false,
  }: {
    label: string;
    val1: number;
    val2: number;
    format?: (v: number) => string;
    isPercentage?: boolean;
  }) => {
    // Determine who has the better stat
    const isHigherBetter = label !== 'Double fautes' && label !== 'Fautes directes non forcées';
    let homeBetter = false;
    let awayBetter = false;

    if (val1 !== val2) {
      if (isHigherBetter) {
        homeBetter = val1 > val2;
        awayBetter = val2 > val1;
      } else {
        homeBetter = val1 < val2;
        awayBetter = val2 < val1;
      }
    }

    // Progress bar values (relative to each other for visual comparison)
    const total = val1 + val2;
    const p1 = total > 0 ? (val1 / total) * 100 : 50;
    const p2 = total > 0 ? (val2 / total) * 100 : 50;

    return (
      <div className="border-border/50 hover:bg-muted/10 flex flex-col rounded-sm border-b px-2 py-3 transition-colors last:border-0">
        <div className="mb-1 flex justify-between text-sm">
          <span
            className={`font-mono ${homeBetter ? 'text-primary font-bold' : 'text-muted-foreground'}`}
          >
            {format(val1)}
            {isPercentage ? '%' : ''}
          </span>
          <span className="text-foreground/80 font-medium">{label}</span>
          <span
            className={`font-mono ${awayBetter ? 'text-primary font-bold' : 'text-muted-foreground'}`}
          >
            {format(val2)}
            {isPercentage ? '%' : ''}
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
  };

  return (
    <Card className="bg-card/50 border-border shadow-lg backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between text-lg">
          <span className="text-muted-foreground">{shortName(players.home.name)}</span>
          <span className="text-primary/70 text-xs tracking-widest uppercase">Statistiques</span>
          <span className="text-muted-foreground">{shortName(players.away.name)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-4">
        <StatRow label="Aces" val1={home.aces} val2={away.aces} />
        <StatRow label="Double fautes" val1={home.doubleFaults} val2={away.doubleFaults} />
        <StatRow
          label="1er service réussi"
          val1={home.firstServePercentage}
          val2={away.firstServePercentage}
          isPercentage
        />
        <StatRow
          label="Pts gagnés s/ 1er serv."
          val1={home.firstServePointsWon}
          val2={away.firstServePointsWon}
          isPercentage
        />
        <StatRow
          label="Pts gagnés s/ 2e serv."
          val1={home.secondServePointsWon}
          val2={away.secondServePointsWon}
          isPercentage
        />
        <StatRow label="Coups gagnants" val1={home.winners} val2={away.winners} />
        <StatRow label="Fautes directes" val1={home.unforcedErrors} val2={away.unforcedErrors} />
        <StatRow
          label="Balles de break"
          val1={home.breakPointsWon}
          val2={away.breakPointsWon}
          format={() => `${home.breakPointsWon}/${home.breakPointsTotal}`}
        />
        <StatRow
          label="Pts gagnés (10 dern.)"
          val1={home.pointsWonLast10}
          val2={away.pointsWonLast10}
        />
      </CardContent>
    </Card>
  );
}
