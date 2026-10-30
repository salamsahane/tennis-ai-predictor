'use client';

import Link from 'next/link';
import { formatPlayerName } from '@/lib/utils';
import type { MatchSearchResult } from '@/types/tennis.types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Trophy, MapPin } from 'lucide-react';

interface MatchCardProps {
  match: MatchSearchResult;
}

export function MatchCard({ match }: MatchCardProps) {
  const idStr = match.id.split(':').pop();

  return (
    <Card className="overflow-hidden bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 border-primary/20 hover:border-primary/50 group cursor-pointer shadow-md hover:shadow-primary/10">
      <Link href={`/match/${idStr}`} className="block">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-center justify-between p-6 gap-6">
            
            {/* Context Info */}
            <div className="flex-1 space-y-3 w-full">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={match.status === 'live' ? 'destructive' : 'secondary'} className="animate-pulse-subtle">
                  {match.status === 'live' ? '🔴 LIVE' : match.status.toUpperCase()}
                </Badge>
                <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px] md:max-w-[200px]" title={match.tournament}>{match.tournament}</span>
                </div>
                {match.venue && (
                  <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[150px]" title={match.venue}>{match.venue}</span>
                  </div>
                )}
              </div>

              {/* Players & Score */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-lg font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
                    {formatPlayerName(match.home_player)}
                  </div>
                  <div className="text-lg font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
                    {formatPlayerName(match.away_player)}
                  </div>
                </div>

                <div className="px-4 py-2 bg-background/50 rounded-lg border border-border flex items-center justify-center shrink-0">
                  <span className="font-mono font-bold text-[var(--color-tennis-green)] tracking-widest text-lg">
                    {match.score}
                  </span>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="hidden md:flex shrink-0 items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 transform group-hover:translate-x-1">
              <ArrowRight className="w-5 h-5" />
            </div>

            <div className="w-full md:hidden flex items-center justify-center gap-2 text-sm text-primary font-medium py-2 bg-primary/10 rounded-lg mt-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <span>Suivre ce match</span>
              <ArrowRight className="w-4 h-4" />
            </div>
            
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
