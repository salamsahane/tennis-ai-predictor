'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { VerdictResult } from '@/types/verdict.types';
import { getConfidenceColor, getConfidenceBgColor, shortName } from '@/lib/utils';
import { Trophy, Zap, Info } from 'lucide-react';
import { ConfidenceMeter } from '@/components/predictions/ConfidenceMeter';

interface VerdictCardProps {
  verdict: VerdictResult;
}

export function VerdictCard({ verdict }: VerdictCardProps) {
  const winnerName = shortName(verdict.predicted_winner);
  const colorClass = getConfidenceColor(verdict.confidence_level);
  const bgClass = getConfidenceBgColor(verdict.confidence_level);

  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-xl">
      <div className="bg-primary/10 p-3 flex items-center justify-center gap-2 border-b border-primary/10">
        <Trophy className="w-5 h-5 text-[var(--color-tennis-ball)]" />
        <h3 className="font-bold tracking-widest uppercase text-sm">Verdict Final</h3>
      </div>

      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-6">

          <div className="space-y-2">
            <p className="text-muted-foreground uppercase tracking-widest text-xs font-semibold">Gagnant prédit</p>
            <h2 className={`text-4xl md:text-5xl font-black tracking-tight ${colorClass} drop-shadow-md`}>
              {winnerName}
            </h2>
            {verdict.is_break_predicted && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/20 text-orange-500 rounded-full text-sm font-bold mt-2 border border-orange-500/30">
                <Zap className="w-4 h-4" />
                BREAK PRÉDIT
              </div>
            )}
          </div>

          <div className="w-full max-w-md pt-4 pb-2">
            <ConfidenceMeter score={verdict.confidence_score} level={verdict.confidence_level} />
          </div>

          <div className="flex flex-wrap justify-center gap-2 text-sm font-medium pt-2 w-full border-t border-border/50">
            <div className="px-3 py-1.5 bg-background/50 rounded-lg border border-border flex items-center gap-2">
              <span className="text-muted-foreground text-xs uppercase">Accord</span>
              <span className="font-bold">{verdict.agreement}</span>
            </div>

            <div className="px-3 py-1.5 bg-background/50 rounded-lg border border-border flex items-center gap-2">
              <span className="text-muted-foreground text-xs uppercase">Score attendu</span>
              <span className="font-mono font-bold text-primary">{verdict.predicted_score}</span>
            </div>
          </div>

          <div className="w-full text-left p-4 bg-muted/30 rounded-lg text-sm border border-border/50 flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-foreground/80 leading-relaxed">
              {verdict.summary}
            </p>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
