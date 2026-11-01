'use client';

import Link from 'next/link';
import { formatPlayerName } from '@/lib/utils';
import type { MatchSearchResult } from '@/types/tennis.types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SourceBadge } from '@/components/match/SourceBadge';
import { ArrowRight, Trophy, MapPin } from 'lucide-react';

interface MatchCardProps {
  match: MatchSearchResult;
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <Card className="bg-card/50 hover:bg-card/80 border-primary/20 hover:border-primary/50 group hover:shadow-primary/10 cursor-pointer overflow-hidden shadow-md backdrop-blur-sm transition-all duration-300">
      <Link href={`/match/${encodeURIComponent(match.id)}`} className="block">
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-between gap-6 p-6 md:flex-row">
            {/* Context Info */}
            <div className="w-full flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {!(match.source.kind === 'replay' && match.status === 'live') && (
                  <Badge
                    variant={match.status === 'live' ? 'destructive' : 'secondary'}
                    className="animate-pulse-subtle"
                  >
                    {match.status === 'live' ? '🔴 LIVE' : match.status.toUpperCase()}
                  </Badge>
                )}
                <SourceBadge source={match.source} />
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Trophy className="h-3.5 w-3.5" />
                  <span
                    className="max-w-[150px] truncate md:max-w-[200px]"
                    title={match.tournament}
                  >
                    {match.tournament}
                  </span>
                </div>
                {match.venue && (
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="max-w-[150px] truncate" title={match.venue}>
                      {match.venue}
                    </span>
                  </div>
                )}
              </div>

              {/* Players & Score */}
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="text-foreground/90 group-hover:text-foreground text-lg font-semibold tracking-tight transition-colors">
                    {formatPlayerName(match.home_player)}
                  </div>
                  <div className="text-foreground/90 group-hover:text-foreground text-lg font-semibold tracking-tight transition-colors">
                    {formatPlayerName(match.away_player)}
                  </div>
                </div>

                <div className="bg-background/50 border-border flex shrink-0 items-center justify-center rounded-lg border px-4 py-2">
                  <span className="font-mono text-lg font-bold tracking-widest text-[var(--color-tennis-green)]">
                    {match.score}
                  </span>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground hidden h-12 w-12 shrink-0 transform items-center justify-center rounded-full transition-all duration-300 group-hover:translate-x-1 md:flex">
              <ArrowRight className="h-5 w-5" />
            </div>

            <div className="text-primary bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors md:hidden">
              <span>Suivre ce match</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
