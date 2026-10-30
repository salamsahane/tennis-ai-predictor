'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { MatchData } from '@/types/tennis.types';
import { formatPlayerName, shortName } from '@/lib/utils';
import { Circle } from 'lucide-react';

interface LiveScoreBoardProps {
  match: MatchData;
}

export function LiveScoreBoard({ match }: LiveScoreBoardProps) {
  const { players, score } = match;

  // Format sets table
  const sets = score.periodScores || [];

  return (
    <Card className="bg-card border-border animate-slide-in overflow-hidden shadow-lg">
      <CardContent className="p-0">
        <div className="flex flex-col">
          {/* Header */}
          <div className="bg-muted/50 border-border text-muted-foreground flex border-b p-3 text-center text-xs font-semibold">
            <div className="flex-1 px-4 text-left">JOUEURS</div>
            <div className="flex max-w-[200px] flex-[2]">
              {sets.map((set, i) => (
                <div key={i} className="flex-1 px-2">
                  {i + 1}
                </div>
              ))}
              {sets.length < 5 &&
                Array.from({ length: 5 - sets.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex-1 px-2 opacity-30">
                    {sets.length + i + 1}
                  </div>
                ))}
            </div>
            <div className="flex-1 px-4 text-right text-[var(--color-tennis-green)]">JEU</div>
          </div>

          {/* Home Player Row */}
          <div className="border-border hover:bg-muted/20 flex items-center border-b p-3 transition-colors">
            <div className="flex flex-1 items-center gap-3 px-2">
              <div className="flex h-4 w-4 items-center justify-center">
                {score.serving === 'home' && (
                  <div className="animate-pulse-subtle h-2.5 w-2.5 rounded-full bg-[var(--color-tennis-ball)] shadow-[0_0_8px_var(--color-tennis-ball)]" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {players.home.seed && (
                  <span className="text-muted-foreground text-xs">({players.home.seed})</span>
                )}
                <span
                  className="max-w-[150px] truncate text-sm font-semibold tracking-tight md:max-w-xs md:text-base"
                  title={formatPlayerName(players.home.name)}
                >
                  {shortName(players.home.name)}
                </span>
                <span className="text-muted-foreground ml-1 font-mono text-xs">
                  {players.home.country}
                </span>
              </div>
            </div>

            <div className="flex max-w-[200px] flex-[2] text-center font-mono text-lg font-bold">
              {sets.map((set, i) => (
                <div
                  key={i}
                  className={`flex-1 px-2 ${i === sets.length - 1 ? 'text-primary' : 'text-foreground/80'}`}
                >
                  {set.home}
                </div>
              ))}
              {sets.length < 5 &&
                Array.from({ length: 5 - sets.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="text-muted-foreground/20 flex-1 px-2">
                    -
                  </div>
                ))}
            </div>

            <div className="flex-1 px-4 text-right">
              <span className="inline-block min-w-[3rem] rounded-md border border-[var(--color-tennis-green)]/30 bg-[var(--color-tennis-green)]/10 px-3 py-1 text-center font-mono text-xl font-bold text-[var(--color-tennis-green)]">
                {score.currentGame.home}
              </span>
            </div>
          </div>

          {/* Away Player Row */}
          <div className="hover:bg-muted/20 flex items-center p-3 transition-colors">
            <div className="flex flex-1 items-center gap-3 px-2">
              <div className="flex h-4 w-4 items-center justify-center">
                {score.serving === 'away' && (
                  <div className="animate-pulse-subtle h-2.5 w-2.5 rounded-full bg-[var(--color-tennis-ball)] shadow-[0_0_8px_var(--color-tennis-ball)]" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {players.away.seed && (
                  <span className="text-muted-foreground text-xs">({players.away.seed})</span>
                )}
                <span
                  className="max-w-[150px] truncate text-sm font-semibold tracking-tight md:max-w-xs md:text-base"
                  title={formatPlayerName(players.away.name)}
                >
                  {shortName(players.away.name)}
                </span>
                <span className="text-muted-foreground ml-1 font-mono text-xs">
                  {players.away.country}
                </span>
              </div>
            </div>

            <div className="flex max-w-[200px] flex-[2] text-center font-mono text-lg font-bold">
              {sets.map((set, i) => (
                <div
                  key={i}
                  className={`flex-1 px-2 ${i === sets.length - 1 ? 'text-primary' : 'text-foreground/80'}`}
                >
                  {set.away}
                </div>
              ))}
              {sets.length < 5 &&
                Array.from({ length: 5 - sets.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="text-muted-foreground/20 flex-1 px-2">
                    -
                  </div>
                ))}
            </div>

            <div className="flex-1 px-4 text-right">
              <span className="inline-block min-w-[3rem] rounded-md border border-[var(--color-tennis-green)]/30 bg-[var(--color-tennis-green)]/10 px-3 py-1 text-center font-mono text-xl font-bold text-[var(--color-tennis-green)]">
                {score.currentGame.away}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
