'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PredictionEvent } from '@/types/verdict.types';

interface GameHistoryProps {
  predictions: PredictionEvent[];
}

export function GameHistory({ predictions }: GameHistoryProps) {
  if (predictions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/30 border-border">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          Historique des jeux
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[300px] overflow-y-auto p-0">
        <div className="flex flex-col">
          {predictions.map((p, idx) => (
            <div
              key={`${p.set_number}-${p.game_number}`}
              className="border-border/50 hover:bg-muted/20 flex items-center justify-between border-b p-3 text-sm"
            >
              <div className="text-muted-foreground font-mono">
                Set {p.set_number}, Jeu {p.game_number}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Vainqueur prédit :</span>
                <span className="text-primary font-medium">
                  {p.verdict.predicted_winner.split(' ').pop()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
