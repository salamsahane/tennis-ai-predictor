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
    <Card className="border-primary/20 from-card to-primary/5 overflow-hidden border-2 bg-gradient-to-br shadow-xl">
      <div className="bg-primary/10 border-primary/10 flex items-center justify-center gap-2 border-b p-3">
        <Trophy className="h-5 w-5 text-[var(--color-tennis-ball)]" />
        <h3 className="text-sm font-bold tracking-widest uppercase">Verdict Final</h3>
      </div>

      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              Gagnant prédit
            </p>
            <h2
              className={`text-4xl font-black tracking-tight md:text-5xl ${colorClass} drop-shadow-md`}
            >
              {winnerName}
            </h2>
            {verdict.is_break_predicted && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/20 px-3 py-1 text-sm font-bold text-orange-500">
                <Zap className="h-4 w-4" />
                BREAK PRÉDIT
              </div>
            )}
          </div>

          <div className="w-full max-w-md pt-4 pb-2">
            <ConfidenceMeter score={verdict.confidence_score} level={verdict.confidence_level} />
          </div>

          <div className="border-border/50 flex w-full flex-wrap justify-center gap-2 border-t pt-2 text-sm font-medium">
            <div className="bg-background/50 border-border flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <span className="text-muted-foreground text-xs uppercase">Accord</span>
              <span className="font-bold">{verdict.agreement}</span>
            </div>

            <div className="bg-background/50 border-border flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <span className="text-muted-foreground text-xs uppercase">Score attendu</span>
              <span className="text-primary font-mono font-bold">{verdict.predicted_score}</span>
            </div>
          </div>

          <div className="bg-muted/30 border-border/50 flex w-full items-start gap-3 rounded-lg border p-4 text-left text-sm">
            <Info className="text-primary mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-foreground/80 leading-relaxed">{verdict.summary}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
