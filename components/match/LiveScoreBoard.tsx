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
    <Card className="bg-card border-border overflow-hidden shadow-lg animate-slide-in">
      <CardContent className="p-0">
        <div className="flex flex-col">
          {/* Header */}
          <div className="bg-muted/50 p-3 border-b border-border flex text-xs font-semibold text-muted-foreground text-center">
            <div className="flex-1 text-left px-4">JOUEURS</div>
            <div className="flex flex-[2] max-w-[200px]">
              {sets.map((set, i) => (
                <div key={i} className="flex-1 px-2">{i + 1}</div>
              ))}
              {sets.length < 5 && Array.from({ length: 5 - sets.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex-1 px-2 opacity-30">{sets.length + i + 1}</div>
              ))}
            </div>
            <div className="flex-1 px-4 text-right text-[var(--color-tennis-green)]">JEU</div>
          </div>

          {/* Home Player Row */}
          <div className="flex items-center p-3 border-b border-border hover:bg-muted/20 transition-colors">
            <div className="flex-1 flex items-center gap-3 px-2">
              <div className="w-4 h-4 flex items-center justify-center">
                {score.serving === 'home' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-tennis-ball)] animate-pulse-subtle shadow-[0_0_8px_var(--color-tennis-ball)]" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {players.home.seed && <span className="text-xs text-muted-foreground">({players.home.seed})</span>}
                <span className="font-semibold text-sm md:text-base tracking-tight truncate max-w-[150px] md:max-w-xs" title={formatPlayerName(players.home.name)}>
                  {shortName(players.home.name)}
                </span>
                <span className="text-xs font-mono text-muted-foreground ml-1">{players.home.country}</span>
              </div>
            </div>
            
            <div className="flex flex-[2] max-w-[200px] text-center font-mono text-lg font-bold">
              {sets.map((set, i) => (
                <div key={i} className={`flex-1 px-2 ${i === sets.length - 1 ? 'text-primary' : 'text-foreground/80'}`}>
                  {set.home}
                </div>
              ))}
              {sets.length < 5 && Array.from({ length: 5 - sets.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex-1 px-2 text-muted-foreground/20">-</div>
              ))}
            </div>
            
            <div className="flex-1 px-4 text-right">
              <span className="inline-block bg-[var(--color-tennis-green)]/10 text-[var(--color-tennis-green)] border border-[var(--color-tennis-green)]/30 font-mono font-bold text-xl px-3 py-1 rounded-md min-w-[3rem] text-center">
                {score.currentGame.home}
              </span>
            </div>
          </div>

          {/* Away Player Row */}
          <div className="flex items-center p-3 hover:bg-muted/20 transition-colors">
            <div className="flex-1 flex items-center gap-3 px-2">
              <div className="w-4 h-4 flex items-center justify-center">
                {score.serving === 'away' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-tennis-ball)] animate-pulse-subtle shadow-[0_0_8px_var(--color-tennis-ball)]" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {players.away.seed && <span className="text-xs text-muted-foreground">({players.away.seed})</span>}
                <span className="font-semibold text-sm md:text-base tracking-tight truncate max-w-[150px] md:max-w-xs" title={formatPlayerName(players.away.name)}>
                  {shortName(players.away.name)}
                </span>
                <span className="text-xs font-mono text-muted-foreground ml-1">{players.away.country}</span>
              </div>
            </div>
            
            <div className="flex flex-[2] max-w-[200px] text-center font-mono text-lg font-bold">
              {sets.map((set, i) => (
                <div key={i} className={`flex-1 px-2 ${i === sets.length - 1 ? 'text-primary' : 'text-foreground/80'}`}>
                  {set.away}
                </div>
              ))}
              {sets.length < 5 && Array.from({ length: 5 - sets.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex-1 px-2 text-muted-foreground/20">-</div>
              ))}
            </div>
            
            <div className="flex-1 px-4 text-right">
              <span className="inline-block bg-[var(--color-tennis-green)]/10 text-[var(--color-tennis-green)] border border-[var(--color-tennis-green)]/30 font-mono font-bold text-xl px-3 py-1 rounded-md min-w-[3rem] text-center">
                {score.currentGame.away}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
